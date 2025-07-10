import { Customer, QuoteDetails, Discount, CoverageDetails, RiskFactors } from '../types';
import { ActuarialService } from '../services/actuarialService';
import { v4 as uuidv4 } from 'uuid';

export interface QuoteRecommendation {
  recommendedCarrier: string;
  reasoning: string;
  customerProfile: string;
  considerations: string[];
}

export class QuoteGenerator {
  private static instance: QuoteGenerator;
  private actuarialService: ActuarialService;

  public static getInstance(): QuoteGenerator {
    if (!QuoteGenerator.instance) {
      QuoteGenerator.instance = new QuoteGenerator();
    }
    return QuoteGenerator.instance;
  }

  constructor() {
    this.actuarialService = ActuarialService.getInstance();
  }

  // Generate 3 competitive quotes from Canadian carriers using actuarial tables
  async generateQuotes(
    customer: Customer, 
    adjustedBasePremium: number,
    riskFactors: RiskFactors
  ): Promise<{
    quotes: QuoteDetails[];
    recommendation: QuoteRecommendation;
  }> {
    console.log(`[QuoteGenerator] Generating deterministic quotes for ${customer.profile.firstName} ${customer.profile.lastName}`);
    console.log(`[QuoteGenerator] Using actuarial tables - Base Premium: $${adjustedBasePremium}`);

    // Generate 3 carrier quotes using actuarial carrier appetites
    const quotes = [
      this.generateCarrierQuote(customer, adjustedBasePremium, riskFactors, 'Intact Insurance'),
      this.generateCarrierQuote(customer, adjustedBasePremium, riskFactors, 'Aviva Canada'),  
      this.generateCarrierQuote(customer, adjustedBasePremium, riskFactors, 'Economical Insurance')
    ];

    // Generate recommendation based on lowest price (deterministic)
    const recommendation = this.generateQuoteRecommendation(customer, quotes);

    return { quotes, recommendation };
  }

  // Generate carrier quote using actuarial tables
  private generateCarrierQuote(
    customer: Customer, 
    basePremium: number, 
    riskFactors: RiskFactors, 
    carrierName: string
  ): QuoteDetails {
    const carrierInfo = this.actuarialService.getCarrierInfo(carrierName);
    
    // Apply carrier-specific focus factor - KEEP IN FULL PRECISION
    let carrierPremium: number;
    switch (carrierInfo.focus_factor) {
      case 'experienceScore':
        carrierPremium = basePremium * carrierInfo.base_multiplier * riskFactors.experienceScore;
        break;
      case 'usageScore':
        carrierPremium = basePremium * carrierInfo.base_multiplier * riskFactors.usageScore;
        break;
      case 'drivingHistoryScore':
        carrierPremium = basePremium * carrierInfo.base_multiplier * riskFactors.drivingHistoryScore;
        break;
      default:
        carrierPremium = basePremium * carrierInfo.base_multiplier;
    }
    
    // Log the precise calculation for debugging
    console.log(`[QuoteGenerator] ${carrierName} - ${carrierInfo.description}: $${basePremium} * ${carrierInfo.base_multiplier} * focus factor = $${carrierPremium.toFixed(3)}`);
    
    // Apply deterministic discounts based on actuarial table - KEEP IN FULL PRECISION
    const discounts = this.calculateCarrierDiscounts(customer, carrierInfo, carrierPremium);
    
    // Calculate final premium - APPLY ROUNDING ONLY AT THE VERY END
    const totalDiscounts = discounts.reduce((sum, d) => sum + d.amount, 0);
    let finalPremium = carrierPremium - totalDiscounts;
    
    // Log the precise calculation before minimum cap
    console.log(`[QuoteGenerator] ${carrierName} before minimum cap: $${carrierPremium.toFixed(3)} - $${totalDiscounts} = $${finalPremium.toFixed(3)}`);
    
    // Apply minimum discount cap - THIS IS A HARD FLOOR, NO WAIVERS
    const minimumPremium = carrierPremium * carrierInfo.minimum_discount_cap;
    finalPremium = Math.max(finalPremium, minimumPremium);
    
    // CRITICAL: Final rounding occurs here and ONLY here - ALWAYS ROUND UP for insurance quotes
    const roundedFinalPremium = Math.ceil(finalPremium);
    
    // Log the final result
    console.log(`[QuoteGenerator] ${carrierName} final: $${finalPremium.toFixed(3)} → $${roundedFinalPremium} (rounded UP)`);
    
    // Generate coverage details based on carrier profile (pass unrounded for precise calculations)
    const coverageDetails = this.generateCoverageDetails(carrierName, finalPremium, roundedFinalPremium);

    return {
      id: uuidv4(),
      customerId: customer.id,
      carrier: carrierName,
      basePremium: basePremium,
      discounts,
      surcharges: [],
      totalPremium: roundedFinalPremium,
      coverageDetails,
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      generatedAt: new Date() as any,
      features: this.getCarrierFeatures(carrierName)
    };
  }

  // Calculate carrier-specific discounts using actuarial rules
  private calculateCarrierDiscounts(customer: Customer, carrierInfo: any, basePremium: number): Discount[] {
    const discounts: Discount[] = [];
    const violations = customer.profile.driverLicense.violations || [];
    const annualUsage = customer.vehicle.annualUsage || 15000;
    
    console.log(`[QuoteGenerator] [DEBUG] Calculating discounts for ${carrierInfo.name || 'Unknown Carrier'}:`);
    console.log(`[QuoteGenerator] [DEBUG] - Violations: ${JSON.stringify(violations)}`);
    console.log(`[QuoteGenerator] [DEBUG] - Annual Usage: ${annualUsage}`);
    console.log(`[QuoteGenerator] [DEBUG] - Parking Location: "${customer.vehicle.parkingLocation}"`);
    
    // Check each discount condition based on the simplified actuarial table
    Object.entries(carrierInfo.discounts).forEach(([discountType, discountInfo]: [string, any]) => {
      let qualifies = false;
      let description = '';
      
      console.log(`[QuoteGenerator] [DEBUG] Checking discount: ${discountType} (${discountInfo.condition})`);
      
      switch (discountInfo.condition) {
        case 'no_violations':
          qualifies = violations.length === 0;
          description = 'Clean Driving Record Discount';
          console.log(`[QuoteGenerator] [DEBUG] - no_violations: ${violations.length} violations -> qualifies: ${qualifies}`);
          break;
        case 'garage_parking':
          qualifies = customer.vehicle.parkingLocation?.toLowerCase() === 'garage';
          description = 'Secure Parking Discount';
          console.log(`[QuoteGenerator] [DEBUG] - garage_parking: "${customer.vehicle.parkingLocation}" -> qualifies: ${qualifies}`);
          break;
        case 'under_12000_km':
          qualifies = annualUsage < 12000;
          description = 'Low Annual Usage Discount (<12,000km)';
          console.log(`[QuoteGenerator] [DEBUG] - under_12000_km: ${annualUsage} km -> qualifies: ${qualifies}`);
          break;
        case 'under_15000_km':
          qualifies = annualUsage < 15000;
          description = 'Low Annual Usage Discount (<15,000km)';
          console.log(`[QuoteGenerator] [DEBUG] - under_15000_km: ${annualUsage} km -> qualifies: ${qualifies}`);
          break;
        // REMOVED: Legacy discounts not in simplified tables (e.g., age_40_plus, multi_product, new_vehicle)
      }
      
      if (qualifies) {
        const discount = {
          type: discountType,
          description: description,
          amount: discountInfo.amount,
          percentage: Math.round((discountInfo.amount / basePremium) * 100)
        };
        discounts.push(discount);
        console.log(`[QuoteGenerator] [DEBUG] ✅ Applied discount: ${description} = $${discountInfo.amount}`);
      } else {
        console.log(`[QuoteGenerator] [DEBUG] ❌ Did not qualify for: ${description}`);
      }
    });
    
    const totalDiscountAmount = discounts.reduce((sum, d) => sum + d.amount, 0);
    console.log(`[QuoteGenerator] [DEBUG] Total discounts applied: $${totalDiscountAmount}`);
    
    return discounts;
  }

  // Generate coverage details based on carrier
  private generateCoverageDetails(carrierName: string, unroundedPremium: number, roundedPremium: number): CoverageDetails {
    // Standard coverage for all carriers - price becomes the only differentiator
    return {
      liability: {
        bodilyInjuryPerPerson: 1000000,
        bodilyInjuryPerAccident: 2000000,
        propertyDamage: 1000000,
        premium: Math.round(unroundedPremium * 0.4),
      },
      comprehensive: {
        deductible: 500,
        premium: Math.round(unroundedPremium * 0.3),
      },
      collision: {
        deductible: 500,
        premium: Math.round(unroundedPremium * 0.25),
      },
      uninsuredMotorist: {
        bodilyInjuryPerPerson: 1000000,
        bodilyInjuryPerAccident: 2000000,
        premium: Math.round(unroundedPremium * 0.05),
      },
    };
  }

  // Get carrier-specific features
  private getCarrierFeatures(carrierName: string): string[] {
    // All carriers provide the same standard coverage; no unique feature differentiation.
    return [];
  }

  // Generate recommendation based on lowest price (deterministic)
  private generateQuoteRecommendation(customer: Customer, quotes: QuoteDetails[]): QuoteRecommendation {
    if (!quotes || quotes.length === 0) {
      return {
        recommendedCarrier: 'N/A',
        reasoning: 'No quotes were available for comparison.',
        customerProfile: 'Unknown',
        considerations: ['Please review the case manually.']
      };
    }

    // Find the quote with the lowest total premium (deterministic)
    const bestQuote = quotes.reduce((min, q) => q.totalPremium < min.totalPremium ? q : min, quotes[0]);
    
    // Log the comparison for verification
    console.log(`[QuoteGenerator] Deterministic quote comparison:`);
    quotes.forEach(quote => {
      console.log(`[QuoteGenerator] - ${quote.carrier}: $${quote.totalPremium}`);
    });
    console.log(`[QuoteGenerator] ⭐ Lowest price: ${bestQuote.carrier} at $${bestQuote.totalPremium}`);

    const reasoning = `${bestQuote.carrier} offers the lowest premium at $${bestQuote.totalPremium} for your profile.`;

    return {
      recommendedCarrier: bestQuote.carrier || 'Unknown Carrier',
      reasoning: reasoning,
      customerProfile: 'Price-Focused',
      considerations: [
        'This recommendation is based on providing the best available price.',
        'Coverage details and features may vary between carriers.',
        'Consider coverage needs when making final decision.'
      ]
    };
  }

} 