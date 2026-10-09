/**
 * Generates a realistic Kenyan pharmacy catalogue for the Juleb mock.
 *
 * Hand-writing 50+ products as JSON is error-prone and unreviewable; generating
 * them keeps pricing, VAT and dispensing class consistent by construction.
 * Prices are plausible Kenyan retail in KES.
 *
 * Run: node scripts/gen/catalogue.mjs
 */
import { writeFileSync } from 'node:fs';

const P = (name, generic, brand, form, strength, pack, unit, dispensing, price, was, cat, cond) => ({
  name,
  generic,
  brand,
  form,
  strength,
  pack,
  unit,
  dispensing,
  price,
  was,
  cat,
  cond,
});

const CATALOGUE = [
  // Pain and fever — the highest-turnover shelf in any Kenyan pharmacy
  P('Panadol Extra', 'Paracetamol + Caffeine', 'Panadol', 'tablet', '500mg/65mg', '24 tablets', 'pack', 'OTC', 450, 600, 'PAINRELIEF', ['PAIN', 'FEVER']),
  P('Panadol Advance', 'Paracetamol', 'Panadol', 'tablet', '500mg', '24 tablets', 'pack', 'OTC', 380, null, 'PAINRELIEF', ['PAIN', 'FEVER']),
  P('Brufen', 'Ibuprofen', 'Brufen', 'tablet', '400mg', '30 tablets', 'pack', 'OTC', 520, 650, 'PAINRELIEF', ['PAIN']),
  P('Hedex', 'Paracetamol + Caffeine', 'Hedex', 'tablet', '500mg', '12 tablets', 'pack', 'OTC', 160, null, 'PAINRELIEF', ['PAIN']),
  P('Diclofenac Sodium', 'Diclofenac Sodium', null, 'tablet', '50mg', '30 tablets', 'pack', 'POM', 340, null, 'PAINRELIEF', ['PAIN']),
  P('Mara Moja', 'Paracetamol + Caffeine + Aspirin', 'Mara Moja', 'tablet', '500mg', '10 tablets', 'pack', 'OTC', 60, null, 'PAINRELIEF', ['PAIN', 'FEVER']),
  P('Voltaren Emulgel', 'Diclofenac Diethylamine', 'Voltaren', 'gel', '1%', '50g', 'tube', 'OTC', 980, 1200, 'PAINRELIEF', ['PAIN']),

  // Malaria — endemic around Kisumu, so this shelf matters locally
  P('Coartem', 'Artemether + Lumefantrine', 'Coartem', 'tablet', '20mg/120mg', '24 tablets', 'pack', 'POM', 1250, null, 'ANTIMALARIAL', ['MALARIA']),
  P('Duo-Cotecxin', 'Dihydroartemisinin + Piperaquine', 'Duo-Cotecxin', 'tablet', '40mg/320mg', '8 tablets', 'pack', 'POM', 980, 1150, 'ANTIMALARIAL', ['MALARIA']),
  P('Artefan', 'Artemether + Lumefantrine', 'Artefan', 'tablet', '20mg/120mg', '24 tablets', 'pack', 'POM', 890, null, 'ANTIMALARIAL', ['MALARIA']),
  P('Malaria Rapid Test Kit', null, null, 'device', null, '1 test', 'box', 'OTC', 250, null, 'DEVICES', ['MALARIA']),

  // Antibiotics — all POM, which is what makes the pharmacist review demo real
  P('Amoxil', 'Amoxicillin', 'Amoxil', 'capsule', '500mg', '21 capsules', 'pack', 'POM', 640, null, 'ANTIBIOTIC', ['INFECTION']),
  P('Augmentin', 'Amoxicillin + Clavulanic Acid', 'Augmentin', 'tablet', '625mg', '14 tablets', 'pack', 'POM', 1850, 2100, 'ANTIBIOTIC', ['INFECTION']),
  P('Azithromycin', 'Azithromycin', null, 'tablet', '500mg', '3 tablets', 'pack', 'POM', 450, null, 'ANTIBIOTIC', ['INFECTION']),
  P('Ciprofloxacin', 'Ciprofloxacin', null, 'tablet', '500mg', '10 tablets', 'pack', 'POM', 380, null, 'ANTIBIOTIC', ['INFECTION']),
  P('Flagyl', 'Metronidazole', 'Flagyl', 'tablet', '400mg', '21 tablets', 'pack', 'POM', 290, null, 'ANTIBIOTIC', ['INFECTION']),

  // Diabetes
  P('Glucophage', 'Metformin Hydrochloride', 'Glucophage', 'tablet', '500mg', '60 tablets', 'pack', 'POM', 890, 1100, 'ENDOCRINE', ['DIABETES']),
  P('Metformin', 'Metformin Hydrochloride', null, 'tablet', '850mg', '60 tablets', 'pack', 'POM', 520, null, 'ENDOCRINE', ['DIABETES']),
  P('Glibenclamide', 'Glibenclamide', null, 'tablet', '5mg', '30 tablets', 'pack', 'POM', 180, null, 'ENDOCRINE', ['DIABETES']),
  P('Accu-Chek Active Glucometer', null, 'Accu-Chek', 'device', null, '1 kit', 'box', 'OTC', 3450, 4200, 'DEVICES', ['DIABETES']),
  P('Accu-Chek Test Strips', null, 'Accu-Chek', 'device', null, '50 strips', 'box', 'OTC', 2100, null, 'DEVICES', ['DIABETES']),

  // Hypertension and heart
  P('Losartan Potassium', 'Losartan Potassium', null, 'tablet', '50mg', '30 tablets', 'pack', 'POM', 720, null, 'CARDIOVASCULAR', ['HYPERTENSION']),
  P('Amlodipine', 'Amlodipine Besylate', null, 'tablet', '5mg', '30 tablets', 'pack', 'POM', 310, 400, 'CARDIOVASCULAR', ['HYPERTENSION']),
  P('Atenolol', 'Atenolol', null, 'tablet', '50mg', '28 tablets', 'pack', 'POM', 260, null, 'CARDIOVASCULAR', ['HYPERTENSION']),
  P('Aspirin Cardio', 'Acetylsalicylic Acid', 'Aspirin', 'tablet', '75mg', '30 tablets', 'pack', 'OTC', 190, null, 'CARDIOVASCULAR', ['HYPERTENSION']),
  P('Omron Blood Pressure Monitor', null, 'Omron', 'device', null, '1 unit', 'box', 'OTC', 6500, 7800, 'DEVICES', ['HYPERTENSION']),

  // Cough, cold, allergy and asthma
  P('Actifed', 'Triprolidine + Pseudoephedrine', 'Actifed', 'syrup', '100ml', '100ml', 'bottle', 'OTC', 420, null, 'COUGHCOLD', ['COUGH']),
  P('Benylin Dry Cough', 'Dextromethorphan', 'Benylin', 'syrup', '15mg/5ml', '100ml', 'bottle', 'OTC', 480, 560, 'COUGHCOLD', ['COUGH']),
  P('Strepsils Honey and Lemon', 'Amylmetacresol', 'Strepsils', 'lozenge', null, '24 lozenges', 'pack', 'OTC', 280, null, 'COUGHCOLD', ['COUGH']),
  P('Piriton', 'Chlorphenamine Maleate', 'Piriton', 'tablet', '4mg', '30 tablets', 'pack', 'OTC', 150, null, 'COUGHCOLD', ['ALLERGY']),
  P('Cetirizine', 'Cetirizine Hydrochloride', null, 'tablet', '10mg', '10 tablets', 'pack', 'OTC', 120, null, 'COUGHCOLD', ['ALLERGY']),
  P('Ventolin Inhaler', 'Salbutamol', 'Ventolin', 'inhaler', '100mcg', '200 doses', 'box', 'POM', 1150, null, 'RESPIRATORY', ['ASTHMA']),

  // Mum and baby
  P('Calpol Paediatric Suspension', 'Paracetamol', 'Calpol', 'oral suspension', '120mg/5ml', '100ml', 'bottle', 'OTC', 380, null, 'MUMANDBABY', ['FEVER', 'PAIN']),
  P('Pampers Baby Dry', null, 'Pampers', 'nappy', null, '46 nappies', 'pack', 'OTC', 1450, 1700, 'MUMANDBABY', []),
  P('Infacol Colic Drops', 'Simeticone', 'Infacol', 'oral suspension', '40mg/ml', '50ml', 'bottle', 'OTC', 620, null, 'MUMANDBABY', []),
  P('Folic Acid', 'Folic Acid', null, 'tablet', '5mg', '30 tablets', 'pack', 'OTC', 90, null, 'MUMANDBABY', ['PREGNANCY']),
  P('Pregnancy Test Kit', null, null, 'device', null, '1 test', 'box', 'OTC', 150, null, 'DEVICES', ['PREGNANCY']),

  // Supplements
  P('Redoxon Vitamin C', 'Ascorbic Acid', 'Redoxon', 'effervescent tablet', '1000mg', '10 tablets', 'tube', 'OTC', 550, 650, 'SUPPLEMENTS', ['IMMUNITY']),
  P('Centrum Multivitamin', null, 'Centrum', 'tablet', null, '30 tablets', 'pack', 'OTC', 1250, null, 'SUPPLEMENTS', ['IMMUNITY']),
  P('Ferrous Sulphate', 'Ferrous Sulphate', null, 'tablet', '200mg', '30 tablets', 'pack', 'OTC', 140, null, 'SUPPLEMENTS', ['ANAEMIA']),
  P('Calcium plus Vitamin D3', 'Calcium Carbonate', null, 'tablet', '600mg', '30 tablets', 'pack', 'OTC', 480, null, 'SUPPLEMENTS', []),
  P('Omega 3 Fish Oil', null, null, 'capsule', '1000mg', '60 capsules', 'pack', 'OTC', 1350, 1600, 'SUPPLEMENTS', []),
  P('Zinc Sulphate', 'Zinc Sulphate', null, 'tablet', '20mg', '10 tablets', 'pack', 'OTC', 80, null, 'SUPPLEMENTS', ['IMMUNITY']),

  // Stomach
  P('Eno Fruit Salts', 'Sodium Bicarbonate', 'Eno', 'powder', null, '5 sachets', 'sachet', 'OTC', 100, null, 'DIGESTIVE', ['INDIGESTION']),
  P('Omeprazole', 'Omeprazole', null, 'capsule', '20mg', '14 capsules', 'pack', 'POM', 320, null, 'DIGESTIVE', ['INDIGESTION']),
  P('Buscopan', 'Hyoscine Butylbromide', 'Buscopan', 'tablet', '10mg', '20 tablets', 'pack', 'OTC', 410, null, 'DIGESTIVE', ['PAIN']),
  P('ORS Rehydration Sachets', 'Oral Rehydration Salts', null, 'powder', null, '10 sachets', 'sachet', 'OTC', 120, null, 'DIGESTIVE', []),
  P('Imodium', 'Loperamide', 'Imodium', 'capsule', '2mg', '12 capsules', 'pack', 'OTC', 390, null, 'DIGESTIVE', []),

  // Skin and personal care
  P('Betnovate Cream', 'Betamethasone Valerate', 'Betnovate', 'cream', '0.1%', '30g', 'tube', 'POM', 450, null, 'SKINCARE', ['SKIN']),
  P('Canesten Cream', 'Clotrimazole', 'Canesten', 'cream', '1%', '20g', 'tube', 'OTC', 620, 750, 'SKINCARE', ['SKIN']),
  P('Nivea Body Lotion', null, 'Nivea', 'lotion', null, '400ml', 'bottle', 'OTC', 680, null, 'PERSONALCARE', []),
  P('Dettol Antiseptic Liquid', 'Chloroxylenol', 'Dettol', 'liquid', '4.8%', '250ml', 'bottle', 'OTC', 420, null, 'PERSONALCARE', []),

  // Controlled — exercises the stricter path in the pharmacist console
  P('Diazepam', 'Diazepam', null, 'tablet', '5mg', '10 tablets', 'pack', 'controlled', 310, null, 'CNS', ['ANXIETY']),
  P('Tramadol', 'Tramadol Hydrochloride', null, 'capsule', '50mg', '20 capsules', 'pack', 'controlled', 480, null, 'CNS', ['PAIN']),
];

const products = CATALOGUE.map((p, i) => {
  const id = `JP-${String(i + 1).padStart(4, '0')}`;
  // Devices and cosmetics carry 16% VAT in Kenya; medicines are exempt.
  const vat = ['DEVICES', 'PERSONALCARE'].includes(p.cat) ? 0.16 : 0;
  const day = String((i % 27) + 1).padStart(2, '0');
  return {
    id,
    name: p.name,
    generic_name: p.generic,
    brand: p.brand
      ? { id: `JBR-${p.brand.toUpperCase().replace(/[^A-Z0-9]/g, '')}`, name: p.brand }
      : null,
    form: p.form,
    strength: p.strength,
    pack_size: p.pack,
    unit_of_sale: p.unit,
    dispensing_class: p.dispensing,
    price: { amount: p.price.toFixed(2), currency: 'KES' },
    compare_at_price: p.was ? { amount: p.was.toFixed(2), currency: 'KES' } : null,
    vat_rate: vat,
    image_url: null,
    category_ids: [`JC-${p.cat}`],
    condition_ids: p.cond.map((c) => `JH-${c}`),
    is_active: true,
    updated_at: `2026-09-${day}T08:00:00Z`,
  };
});

/*
 * Stock: mostly healthy, with a deliberate scattering of low and out-of-stock so
 * the availability states are visible in a demo rather than theoretical.
 */
const BRANCHES = ['JB-KSM-001', 'JB-KSM-002'];
const stock = [];
products.forEach((p, i) => {
  for (const branch of BRANCHES) {
    let qty = 20 + ((i * 17) % 90);
    if (i % 11 === 3) qty = 0;
    else if (i % 9 === 5) qty = 2 + (i % 3);
    if (branch === 'JB-KSM-002') qty = Math.floor(qty / 2);
    stock.push({
      branch_id: branch,
      product_id: p.id,
      quantity_available: qty,
      as_of: '2026-10-09T06:00:00Z',
    });
  }
});

const dir = 'packages/juleb/src/__fixtures__';
writeFileSync(`${dir}/products.json`, `${JSON.stringify(products, null, 2)}\n`);
writeFileSync(`${dir}/stock.json`, `${JSON.stringify(stock, null, 2)}\n`);

const main = stock.filter((s) => s.branch_id === 'JB-KSM-001');
console.log(`${products.length} products, ${stock.length} stock rows`);
console.log(
  `POM ${products.filter((p) => p.dispensing_class === 'POM').length} · ` +
    `controlled ${products.filter((p) => p.dispensing_class === 'controlled').length} · ` +
    `OTC ${products.filter((p) => p.dispensing_class === 'OTC').length}`,
);
console.log(
  `on offer ${products.filter((p) => p.compare_at_price).length} · ` +
    `out of stock ${main.filter((s) => s.quantity_available === 0).length} · ` +
    `low ${main.filter((s) => s.quantity_available > 0 && s.quantity_available <= 5).length}`,
);
