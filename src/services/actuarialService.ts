import * as fs from 'fs';
import * as path from 'path';

// Actuarial table interfaces
interface AgeRatingTable {
  age_bands: { min_age: number; max_age: number; factor: number; description: string }[];
}

interface VehicleRatingTable {
  make_ratings: Record<string, { base_factor: number; description: string; }>;
  model_adjustments: Record<string, { adjustment: number; description: string }>;
  age_adjustments: { min_year: number; max_year: number; adjustment: number; description: string }[];
}

interface LocationRatingTable {
  province_base_factors: Record<string, { factor: number; description: string }>;
  city_adjustments: Record<string, { adjustment: number; description: string }>;
  parking_adjustments: Record<string, { factor: number; description: string }>;
}

interface UsageRatingTable {
  usage_bands: { min_km: number; max_km: number; factor: number; description: string }[];
  primary_use_adjustments: Record<string, { factor: number; description: string }>;
}

interface ViolationRatingTable {
  base_clean_record: { factor: number; description: string };
  violation_penalties: Record<string, { points: number; description: string }>;
  violation_decay: Record<string, number>;
  escalation_thresholds: Record<string, any>;
}

interface CarrierAppetites {
  carriers: Record<string, {
    focus_factor: string;
    base_multiplier: number;
    description: string;
    discounts: Record<string, { amount: number; condition: string }>;
    minimum_discount_cap: number;
  }>;
}

interface BaseRates {
  base_annual_premium: number;
  risk_factor_weights: Record<string, number>;
  coverage_minimums: Record<string, number>;
  coverage_defaults: Record<string, number>;
}

export class ActuarialService {
  private static instance: ActuarialService;
  private ageTable: AgeRatingTable | null = null;
  private vehicleTable: VehicleRatingTable | null = null;
  private locationTable: LocationRatingTable | null = null;
  private usageTable: UsageRatingTable | null = null;
  private violationTable: ViolationRatingTable | null = null;
  private carrierTable: CarrierAppetites | null = null;
  private baseRates: BaseRates | null = null;

  public static getInstance(): ActuarialService {
    if (!ActuarialService.instance) {
      ActuarialService.instance = new ActuarialService();
    }
    return ActuarialService.instance;
  }

  constructor() {
    this.loadActuarialTables();
  }

  private loadActuarialTables(): void {
    try {
      const basePath = path.join(__dirname, '../../z_actuarial_data');
      
      this.ageTable = JSON.parse(fs.readFileSync(path.join(basePath, 'age_rating_table.json'), 'utf8'));
      this.vehicleTable = JSON.parse(fs.readFileSync(path.join(basePath, 'vehicle_rating_table.json'), 'utf8'));
      this.locationTable = JSON.parse(fs.readFileSync(path.join(basePath, 'location_rating_table.json'), 'utf8'));
      this.usageTable = JSON.parse(fs.readFileSync(path.join(basePath, 'usage_rating_table.json'), 'utf8'));
      this.violationTable = JSON.parse(fs.readFileSync(path.join(basePath, 'violation_rating_table.json'), 'utf8'));
      this.carrierTable = JSON.parse(fs.readFileSync(path.join(basePath, 'carrier_appetites.json'), 'utf8'));
      this.baseRates = JSON.parse(fs.readFileSync(path.join(basePath, 'base_rates.json'), 'utf8'));
      
      console.log('[ActuarialService] All actuarial tables loaded successfully');
    } catch (error) {
      console.error('[ActuarialService] Failed to load actuarial tables:', error);
      throw new Error('Critical actuarial data missing - system cannot operate');
    }
  }

  // Age-based driver experience rating
  getExperienceFactor(age: number): { factor: number; description: string } {
    if (!this.ageTable) throw new Error('Age rating table not loaded');
    
    const ageBand = this.ageTable.age_bands.find(band => 
      age >= band.min_age && age <= band.max_age
    );
    
    if (!ageBand) {
      console.warn(`[ActuarialService] Age ${age} not found in table, using default 1.0`);
      return { factor: 1.0, description: 'Age out of range - default factor' };
    }
    
    return { factor: ageBand.factor, description: ageBand.description };
  }

  // Vehicle safety rating
  getVehicleSafetyFactor(make: string, model: string, year: number): { factor: number; description: string } {
    if (!this.vehicleTable) throw new Error('Vehicle rating table not loaded');
    
    let factor = 1.0; // Default base factor
    let description = 'Standard vehicle rating';
    
    // 1. Check make rating
    const makeLower = make.toLowerCase();
    const makeKey = Object.keys(this.vehicleTable.make_ratings).find(key => 
      key.toLowerCase() === makeLower
    );
    
    if (makeKey) {
      factor = this.vehicleTable.make_ratings[makeKey].base_factor;
      description = this.vehicleTable.make_ratings[makeKey].description;
    }
    
    // 2. Check model-specific adjustments - REMOVED FOR SIMPLICITY
    // const modelLower = model.toLowerCase();
    // const modelKey = Object.keys(this.vehicleTable.model_adjustments).find(key => 
    //   modelLower.includes(key.toLowerCase())
    // );
    
    // if (modelKey) {
    //   factor += this.vehicleTable.model_adjustments[modelKey].adjustment;
    //   description += ` + ${this.vehicleTable.model_adjustments[modelKey].description}`;
    // }
    
    // 3. Apply age adjustment
    const ageAdjustment = this.vehicleTable.age_adjustments.find(adj => 
      year >= adj.min_year && year <= adj.max_year
    );
    
    if (ageAdjustment) {
      factor += ageAdjustment.adjustment;
      description += ` + ${ageAdjustment.description}`;
    }
    
    // Ensure factor stays within reasonable bounds
    factor = Math.max(0.5, Math.min(2.0, factor));
    
    return { factor, description };
  }

  // Location risk rating
  getLocationFactor(province: string, city: string, parkingLocation: string): { factor: number; description: string } {
    if (!this.locationTable) throw new Error('Location rating table not loaded');
    
    let factor = 1.0;
    let description = 'Standard location rating';
    
    // 1. Province base factor
    const provinceUpper = province.toUpperCase();
    if (this.locationTable.province_base_factors[provinceUpper]) {
      factor = this.locationTable.province_base_factors[provinceUpper].factor;
      description = this.locationTable.province_base_factors[provinceUpper].description;
    }
    
    // 2. City adjustment - FIXED: Use exact case-insensitive match for mathematical precision
    const cityKey = Object.keys(this.locationTable.city_adjustments).find(key => 
      key.toLowerCase() === city.toLowerCase()
    );
    
    if (cityKey) {
      factor += this.locationTable.city_adjustments[cityKey].adjustment;
      description += ` + ${this.locationTable.city_adjustments[cityKey].description}`;
    }
    
    // 3. Parking adjustment - FIXED: Use exact case-insensitive match for mathematical precision
    const parkingLower = parkingLocation.toLowerCase();
    const parkingKey = Object.keys(this.locationTable.parking_adjustments).find(key => 
      key.toLowerCase() === parkingLower
    );
    
    if (parkingKey) {
      factor *= this.locationTable.parking_adjustments[parkingKey].factor;
      description += ` + ${this.locationTable.parking_adjustments[parkingKey].description}`;
    }
    
    return { factor, description };
  }

  // Usage-based rating
  getUsageFactor(annualKm: number, primaryUse: string = 'commute'): { factor: number; description: string } {
    if (!this.usageTable) throw new Error('Usage rating table not loaded');
    
    // Find usage band
    const usageBand = this.usageTable.usage_bands.find(band => 
      annualKm >= band.min_km && annualKm <= band.max_km
    );
    
    let factor = usageBand ? usageBand.factor : 1.0;
    let description = usageBand ? usageBand.description : 'Usage out of range';
    
    // Apply primary use adjustment
    const useLower = primaryUse.toLowerCase();
    const useKey = Object.keys(this.usageTable.primary_use_adjustments).find(key => 
      useLower.includes(key.toLowerCase())
    );
    
    if (useKey) {
      factor *= this.usageTable.primary_use_adjustments[useKey].factor;
      description += ` + ${this.usageTable.primary_use_adjustments[useKey].description}`;
    }
    
    return { factor, description };
  }

  // Driving history/violation rating
  getDrivingHistoryFactor(violations: any[]): { factor: number; description: string; escalationRequired: boolean } {
    if (!this.violationTable) throw new Error('Violation rating table not loaded');
    
    if (!violations || violations.length === 0) {
      return {
        factor: this.violationTable.base_clean_record.factor,
        description: this.violationTable.base_clean_record.description,
        escalationRequired: false
      };
    }
    
    let totalPoints = 0;
    let descriptions: string[] = [];
    let escalationRequired = false;
    let atFaultAccidents = 0;
    
    const currentDate = new Date();
    
    violations.forEach(violation => {
      const violationDate = new Date(violation.date);
      const yearsAgo = (currentDate.getTime() - violationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      
      // Only consider violations within 5 years
      if (yearsAgo <= 5) {
        let violationType = violation.type;
        
        // Map common violation types
        if (violationType === 'speeding') violationType = 'speeding_minor'; // Default to minor
        if (violationType === 'accident') {
          violationType = 'at_fault_accident';
          atFaultAccidents++;
        }
        
        const penalty = this.violationTable!.violation_penalties[violationType];
        if (penalty) {
          // Apply time decay
          let decayFactor = 1.0;
          if (yearsAgo <= 1) decayFactor = this.violationTable!.violation_decay.year_1;
          else if (yearsAgo <= 2) decayFactor = this.violationTable!.violation_decay.year_2;
          else if (yearsAgo <= 3) decayFactor = this.violationTable!.violation_decay.year_3;
          else if (yearsAgo <= 4) decayFactor = this.violationTable!.violation_decay.year_4;
          else decayFactor = this.violationTable!.violation_decay.year_5_plus;
          
          const adjustedPoints = penalty.points * decayFactor;
          totalPoints += adjustedPoints;
          descriptions.push(`${penalty.description} (${adjustedPoints.toFixed(2)} points)`);
          
          // Check for immediate escalation triggers
          if (violationType === 'dui') escalationRequired = true;
        }
      }
    });
    
    // Check escalation thresholds
    if (atFaultAccidents >= this.violationTable.escalation_thresholds.multiple_at_fault) {
      escalationRequired = true;
    }
    if (totalPoints >= this.violationTable.escalation_thresholds.total_points_threshold) {
      escalationRequired = true;
    }
    
    const finalFactor = Math.max(0.5, Math.min(2.0, 1.0 + totalPoints));
    const description = descriptions.length > 0 ? descriptions.join(', ') : 'Minor violations';
    
    return { factor: finalFactor, description, escalationRequired };
  }

  // Get carrier-specific information
  getCarrierInfo(carrierName: string) {
    if (!this.carrierTable?.carriers) throw new Error('Carrier table not loaded');
    
    const carrier = this.carrierTable.carriers[carrierName];
    if (!carrier) {
      throw new Error(`Carrier ${carrierName} not found in table`);
    }
    
    return carrier;
  }

  // Get base rates and weights
  getBaseRates() {
    if (!this.baseRates) throw new Error('Base rates not loaded');
    return this.baseRates;
  }

  // Calculate final risk multiplier using actuarial weights
  calculateRiskMultiplier(factors: {
    drivingHistoryScore: number;
    experienceScore: number; 
    vehicleSafetyScore: number;
    usageScore: number;
    locationScore: number;
  }): number {
    if (!this.baseRates) throw new Error('Base rates not loaded');
    
    const weights = this.baseRates.risk_factor_weights;
    
    // Add explicit null checks for each weight property
    const drivingWeight = weights.driving_history ?? 0.40;
    const experienceWeight = weights.driver_experience ?? 0.25;
    const vehicleWeight = weights.vehicle_safety ?? 0.20;
    const usageWeight = weights.vehicle_usage ?? 0.10;
    const locationWeight = weights.location_risk ?? 0.05;
    
    const weighted = 
      factors.drivingHistoryScore * drivingWeight +
      factors.experienceScore * experienceWeight +
      factors.vehicleSafetyScore * vehicleWeight +
      factors.usageScore * usageWeight +
      factors.locationScore * locationWeight;
    
    // Return full precision; all rounding is deferred to the final premium calculation step (see Manifesto)
    return weighted;
  }
} 