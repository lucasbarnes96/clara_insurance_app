import { Customer, RatingFactors, RiskFactors } from '../types';
import { ActuarialService } from '../services/actuarialService';

export interface EscalationCheck {
  required: boolean;
  reason: string;
}

export class RiskEngine {
  private static instance: RiskEngine;
  private actuarialService: ActuarialService;

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
    }
    return RiskEngine.instance;
  }

  constructor() {
    this.actuarialService = ActuarialService.getInstance();
  }

  // Main risk assessment method - fully deterministic using actuarial tables
  async calculateRiskFactors(
    customer: Customer,
    workflowId: string,
    customerAnalysis?: any // Kept for compatibility but not used in deterministic mode
  ): Promise<RiskFactors> {
    const reasoning: string[] = [];

    console.log(`[RiskEngine] Starting deterministic actuarial risk assessment for workflow: ${workflowId}`);

    // Calculate age for driver experience assessment
    const birthYear = new Date(customer.profile.dateOfBirth).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    // 1. Driver Experience Assessment (25% weight) - Actuarial age table
    const experienceResult = this.actuarialService.getExperienceFactor(age);
    const experienceScore = experienceResult.factor;
    reasoning.push(`Age ${age}: ${experienceResult.description} (Factor: ${experienceScore})`);

    // 2. Driving History Assessment (40% weight) - Actuarial violation table
    const drivingResult = this.actuarialService.getDrivingHistoryFactor(
      customer.profile.driverLicense.violations || []
    );
    const drivingHistoryScore = drivingResult.factor;
    reasoning.push(`Driving History: ${drivingResult.description} (Factor: ${drivingHistoryScore})`);

    // 3. Vehicle Safety Assessment (20% weight) - Actuarial vehicle table
    const vehicleResult = this.actuarialService.getVehicleSafetyFactor(
      customer.vehicle.make,
      customer.vehicle.model,
      parseInt(customer.vehicle.year)
    );
    const vehicleSafetyScore = vehicleResult.factor;
    reasoning.push(`Vehicle ${customer.vehicle.year} ${customer.vehicle.make} ${customer.vehicle.model}: ${vehicleResult.description} (Factor: ${vehicleSafetyScore})`);

    // 4. Usage Assessment (10% weight) - Actuarial usage table
    const usageResult = this.actuarialService.getUsageFactor(
      customer.vehicle.annualUsage || 15000,
      customer.vehicle.primaryUse || 'commute'
    );
    const usageScore = usageResult.factor;
    reasoning.push(`Usage ${customer.vehicle.annualUsage || 'default'} km/year: ${usageResult.description} (Factor: ${usageScore})`);

    // 5. Location Assessment (5% weight) - Actuarial location table
    const locationResult = this.actuarialService.getLocationFactor(
      customer.profile.address.state || 'ON',
      customer.profile.address.city || '',
      customer.vehicle.parkingLocation || 'street'
    );
    const locationScore = locationResult.factor;
    reasoning.push(`Location ${customer.profile.address.city}, ${customer.profile.address.state}: ${locationResult.description} (Factor: ${locationScore})`);

    console.log(`[RiskEngine] Deterministic risk factors calculated:`, {
      drivingHistoryScore,
      experienceScore,
      vehicleSafetyScore,
      usageScore,
      locationScore
    });

    return {
      drivingHistoryScore,
      experienceScore,
      vehicleSafetyScore,
      usageScore,
      locationScore,
      reasoning
    };
  }

  // Calculate overall risk multiplier from individual factors
  calculateRiskMultiplier(factors: RiskFactors): number {
    return this.actuarialService.calculateRiskMultiplier(factors);
  }

  // Check if case requires human escalation - using actuarial escalation rules
  checkForEscalation(customer: Customer, factors: RiskFactors): EscalationCheck {
    const violations = customer.profile.driverLicense.violations || [];

    // Use actuarial service to check driving history escalation
    const drivingResult = this.actuarialService.getDrivingHistoryFactor(violations);
    if (drivingResult.escalationRequired) {
      return {
        required: true,
        reason: `Actuarial escalation triggered: ${drivingResult.description}`
      };
    }

    // Check age-based escalation for young drivers with violations
    const birthYear = new Date(customer.profile.dateOfBirth).getFullYear();
    const age = new Date().getFullYear() - birthYear;

    if (age < 25 && violations.length >= 2) {
      return {
        required: true,
        reason: 'Young driver with multiple violations requires underwriter review'
      };
    }

    // Check overall risk multiplier threshold
    const riskMultiplier = this.calculateRiskMultiplier(factors);
    if (riskMultiplier >= 1.5) {
      return {
        required: true,
        reason: `High risk profile (${riskMultiplier.toFixed(3)}x base rate) requires underwriter review`
      };
    }

    return { required: false, reason: '' };
  }

  // Convert simplified factors to legacy RatingFactors format
  convertToRatingFactors(factors: RiskFactors, riskMultiplier: number): RatingFactors {
    return {
      ageRating: factors.experienceScore,
      experienceRating: factors.experienceScore,
      locationRating: factors.locationScore,
      vehicleRating: factors.vehicleSafetyScore,
      creditRating: 1.0, // Not used in simplified model
      violationRating: factors.drivingHistoryScore,
      coverageRating: factors.usageScore
    };
  }

  // Get human-readable risk description
  getRiskDescription(riskMultiplier: number): string {
    if (riskMultiplier <= 0.85) return 'Excellent Risk';
    if (riskMultiplier <= 0.95) return 'Good Risk';
    if (riskMultiplier <= 1.1) return 'Average Risk';
    if (riskMultiplier <= 1.3) return 'Higher Risk';
    return 'High Risk';
  }

  // Calculate risk multiplier from existing rating factors (legacy compatibility)
  calculateRiskMultiplierFromRatingFactors(ratingFactors: RatingFactors): number {
    const average =
      (ratingFactors.ageRating +
        ratingFactors.experienceRating +
        ratingFactors.locationRating +
        ratingFactors.vehicleRating +
        ratingFactors.violationRating +
        ratingFactors.coverageRating) /
      6;

    return Math.round(average * 1000) / 1000;
  }
} 