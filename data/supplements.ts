
export interface SupplementInfo {
  name: string;
  type: 'Herbal' | 'Vitamin' | 'Mineral' | 'Amino Acid' | 'Other';
}

export const supplementDatabase: SupplementInfo[] = [
    // Vitamins
    { name: 'Vitamin A', type: 'Vitamin' },
    { name: 'Vitamin B1 (Thiamine)', type: 'Vitamin' },
    { name: 'Vitamin B2 (Riboflavin)', type: 'Vitamin' },
    { name: 'Vitamin B3 (Niacin)', type: 'Vitamin' },
    { name: 'Vitamin B5 (Pantothenic Acid)', type: 'Vitamin' },
    { name: 'Vitamin B6 (Pyridoxine)', type: 'Vitamin' },
    { name: 'Vitamin B7 (Biotin)', type: 'Vitamin' },
    { name: 'Vitamin B9 (Folate/Folic Acid)', type: 'Vitamin' },
    { name: 'Vitamin B12 (Cobalamin)', type: 'Vitamin' },
    { name: 'Vitamin C (Ascorbic Acid)', type: 'Vitamin' },
    { name: 'Vitamin D', type: 'Vitamin' },
    { name: 'Vitamin E', type: 'Vitamin' },
    { name: 'Vitamin K', type: 'Vitamin' },

    // Minerals
    { name: 'Calcium', type: 'Mineral' },
    { name: 'Magnesium', type: 'Mineral' },
    { name: 'Iron', type: 'Mineral' },
    { name: 'Zinc', type: 'Mineral' },
    { name: 'Potassium', type: 'Mineral' },
    { name: 'Selenium', type: 'Mineral' },
    { name: 'Chromium', type: 'Mineral' },
    { name: 'Iodine', type: 'Mineral' },
    { name: 'Copper', type: 'Mineral' },
    { name: 'Manganese', type: 'Mineral' },

    // Herbal Supplements
    { name: 'St. John\'s Wort', type: 'Herbal' },
    { name: 'Ginkgo Biloba', type: 'Herbal' },
    { name: 'Ginseng (Panax)', type: 'Herbal' },
    { name: 'Echinacea', type: 'Herbal' },
    { name: 'Garlic (Allium sativum)', type: 'Herbal' },
    { name: 'Turmeric (Curcumin)', type: 'Herbal' },
    { name: 'Saw Palmetto', type: 'Herbal' },
    { name: 'Valerian Root', type: 'Herbal' },
    { name: 'Milk Thistle', type: 'Herbal' },
    { name: 'Ashwagandha', type: 'Herbal' },
    { name: 'Black Cohosh', type: 'Herbal' },
    { name: 'Feverfew', type: 'Herbal' },
    { name: 'Goldenseal', type: 'Herbal' },
    { name: 'Kava Kava', type: 'Herbal' },
    { name: 'Licorice Root', type: 'Herbal' },
    { name: 'Hawthorn', type: 'Herbal' },
    { name: 'Green Tea Extract', type: 'Herbal' },
    { name: 'Functional Mushrooms (Reishi, Cordyceps, Lion\'s Mane)', type: 'Herbal' },
    
    // Amino Acids
    { name: 'L-Arginine', type: 'Amino Acid' },
    { name: 'L-Carnitine', type: 'Amino Acid' },
    { name: 'L-Glutamine', type: 'Amino Acid' },
    { name: 'L-Tryptophan', type: 'Amino Acid' },
    { name: '5-HTP', type: 'Amino Acid' },
    { name: 'N-Acetylcysteine (NAC)', type: 'Amino Acid' },
    { name: 'Collagen', type: 'Amino Acid' },
    
    // Other Common Supplements
    { name: 'Coenzyme Q10 (CoQ10)', type: 'Other' },
    { name: 'Fish Oil (Omega-3)', type: 'Other' },
    { name: 'Melatonin', type: 'Other' },
    { name: 'Glucosamine', type: 'Other' },
    { name: 'Chondroitin', type: 'Other' },
    { name: 'Probiotics', type: 'Other' },
    { name: 'Creatine', type: 'Other' },
    { name: 'Red Yeast Rice', type: 'Other' },
    { name: 'SAM-e', type: 'Other' },
    { name: 'DHEA', type: 'Other' },
    { name: 'Alpha-Lipoic Acid', type: 'Other' },
];
