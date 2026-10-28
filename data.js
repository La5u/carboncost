// DRAFT: every figure here still needs checking against its source before launch.
//
// Each entry is one variant of an item (e.g. item 'Beef': steak, burger). The first
// entry of an item is its default, used when comparing against it.
// Each entry gives either:
//   g:   [low, central, high] grams CO2e per unit, or
//   kwh: [low, central, high] kWh per unit (electricity only); grams = kWh × grid intensity.
// Entries with per: 'km' are per passenger-km.

// Grid carbon intensity, g CO2e per kWh (Ember, 2023 data)
window.GRIDS = {
  WORLD: ['World average', 480],
  UK: ['United Kingdom', 238],
  EU: ['European Union', 244],
  FR: ['France', 56],
  DE: ['Germany', 381],
  US: ['United States', 369],
  CA: ['Canada', 170],
  AU: ['Australia', 549],
  IN: ['India', 713],
  CN: ['China', 582],
  JP: ['Japan', 485],
};
window.GRID_SOURCE = ['Ember, electricity data explorer', 'https://ember-energy.org/data/'];

const OWID_FOOD = ['Poore & Nemecek (2018), via Our World in Data', 'https://ourworldindata.org/grapher/ghg-per-kg-poore'];
const DESNZ = ['UK DESNZ greenhouse gas conversion factors', 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting'];
const BANANAS = ['Mike Berners-Lee, How Bad Are Bananas? (2020 edition)', null];
const APPLE = ['Apple Product Environmental Reports', 'https://www.apple.com/environment/'];

// Category name → icon
window.CATS = {
  'Food & drink': 'utensils',
  'Transport': 'car',
  'Tech': 'monitor',
  'Home': 'house',
  'Clothes': 'shirt',
  'Disposables': 'file-text',
  'Other': 'user',
};

window.ITEMS = [
  // Food & drink
  { id: 'beef-steak', cat: 'Food & drink', item: 'Beef', icon: 'beef', name: 'Beef steak (200 g)', g: [5000, 12000, 40000],
    note: 'Beef from beef herds: median ~60 kg CO2e per kg; the worst farms are several times higher.', src: [OWID_FOOD] },
  { id: 'burger', cat: 'Food & drink', item: 'Beef', icon: 'hamburger', name: 'Big beef burger', g: [3000, 7000, 20000],
    note: 'Quarter-pound (113 g) beef patty plus bun.', src: [OWID_FOOD] },
  { id: 'pork-chop', cat: 'Food & drink', item: 'Pork', icon: 'ham', name: 'Pork chop (200 g)', g: [1400, 2400, 4000],
    note: 'Pig meat, ~12 kg CO2e per kg.', src: [OWID_FOOD] },
  { id: 'bacon', cat: 'Food & drink', item: 'Pork', icon: 'ham', name: 'Bacon (2 rashers, 50 g)', g: [350, 600, 1000],
    note: 'Pig meat, ~12 kg CO2e per kg.', src: [OWID_FOOD] },
  { id: 'chicken', cat: 'Food & drink', item: 'Chicken', icon: 'drumstick', name: 'Chicken breast (150 g)', g: [600, 1100, 2000],
    note: 'Poultry meat, ~7.5 kg CO2e per kg.', src: [OWID_FOOD] },
  { id: 'chocolate', cat: 'Food & drink', item: 'Chocolate', icon: 'candy', name: 'Dark chocolate bar (50 g)', g: [300, 1000, 2500],
    note: 'Deforestation for cocoa farms dominates and varies hugely.', src: [OWID_FOOD] },
  { id: 'milk', cat: 'Food & drink', item: 'Milk', icon: 'milk', name: 'Glass of cow’s milk (250 ml)', g: [450, 650, 1000],
    note: 'Dairy milk, ~2.7 kg CO2e per litre.', src: [OWID_FOOD] },
  { id: 'oat-milk', cat: 'Food & drink', item: 'Milk', icon: 'wheat', name: 'Glass of oat milk (250 ml)', g: [150, 220, 300],
    note: 'Oat milk, ~0.9 kg CO2e per litre.', src: [OWID_FOOD] },
  { id: 'beer', cat: 'Food & drink', item: 'Beer', icon: 'beer', name: 'Pint of beer', g: [300, 500, 900],
    note: 'Local draught ≈ 300 g; imported bottle ≈ 900 g.', src: [BANANAS] },
  { id: 'rice', cat: 'Food & drink', item: 'Rice', icon: 'soup', name: 'Portion of rice (75 g dry)', g: [150, 330, 500],
    note: '~4.5 kg CO2e per kg, mostly methane from flooded paddies.', src: [OWID_FOOD] },
  { id: 'egg', cat: 'Food & drink', item: 'Egg', icon: 'egg', name: 'Egg (60 g)', g: [150, 250, 400],
    note: '~4.2 kg CO2e per kg.', src: [OWID_FOOD] },
  { id: 'coffee', cat: 'Food & drink', item: 'Coffee', icon: 'coffee', name: 'Cup of black coffee', g: [80, 150, 400],
    note: '7–10 g of coffee beans. Excludes boiling the water.', src: [OWID_FOOD] },
  { id: 'latte', cat: 'Food & drink', item: 'Coffee', icon: 'coffee', name: 'Latte (200 ml cow’s milk)', g: [400, 700, 1200],
    note: 'Coffee beans plus 200 ml of dairy milk. Excludes heating.', src: [OWID_FOOD] },
  { id: 'banana', cat: 'Food & drink', item: 'Banana', icon: 'banana', name: 'Banana (120 g)', g: [60, 100, 150],
    note: '~0.9 kg CO2e per kg.', src: [OWID_FOOD] },

  // Transport (per passenger-km unless stated)
  { id: 'flight-short', cat: 'Transport', item: 'Flight', icon: 'plane-takeoff', name: 'Domestic flight', per: 'km', g: [150, 246, 300],
    note: 'Per passenger, including non-CO2 warming effects (radiative forcing).', src: [DESNZ] },
  { id: 'flight-long', cat: 'Transport', item: 'Flight', icon: 'plane', name: 'Long-haul flight', per: 'km', g: [100, 150, 430],
    note: 'Per passenger including radiative forcing. Economy → business class.', src: [DESNZ] },
  { id: 'flight-ny', cat: 'Transport', item: 'Flight', icon: 'globe', name: 'Return flight London ↔ New York', g: [1000000, 1700000, 4800000],
    note: '~11,100 km round trip. Economy → business class, including radiative forcing.', src: [DESNZ] },
  { id: 'car', cat: 'Transport', item: 'Car', icon: 'car', name: 'Petrol car, driver alone', per: 'km', g: [110, 165, 280],
    note: 'Average petrol car. Small car → large SUV.', src: [DESNZ] },
  { id: 'ev', cat: 'Transport', item: 'Car', icon: 'plug-zap', name: 'Electric car, driver alone', per: 'km', kwh: [0.15, 0.19, 0.25],
    note: 'Electricity including charging losses. Excludes manufacture (battery and car).', src: [DESNZ] },
  { id: 'bus', cat: 'Transport', item: 'Bus', icon: 'bus', name: 'Bus', per: 'km', g: [50, 100, 170],
    note: 'Average local bus per passenger; London buses are at the low end.', src: [DESNZ] },
  { id: 'e-scooter', cat: 'Transport', item: 'E-scooter', icon: 'scooter', name: 'Shared e-scooter', per: 'km', g: [35, 70, 130],
    note: 'Life cycle including vehicle manufacture and collection vans for charging.',
    src: [['International Transport Forum (2020), Good to Go?', 'https://www.itf-oecd.org/good-go-assessing-environmental-performance-new-mobility']] },
  { id: 'train', cat: 'Transport', item: 'Train', icon: 'train-front', name: 'Train', per: 'km', g: [5, 35, 60],
    note: 'UK national rail average per passenger; Eurostar ≈ 4 g.', src: [DESNZ] },

  // Tech
  { id: 'laptop', cat: 'Tech', item: 'New laptop', icon: 'laptop', name: 'New laptop', g: [150000, 250000, 400000],
    note: 'Manufacturer life-cycle figures.', src: [APPLE] },
  { id: 'smartphone', cat: 'Tech', item: 'New phone', icon: 'smartphone', name: 'New smartphone', g: [40000, 60000, 90000],
    note: 'Manufacturer life-cycle figures; manufacturing is ~80% of the total.', src: [APPLE] },
  { id: 'streaming', cat: 'Tech', item: 'Video/h', icon: 'tv', name: 'Hour of video streaming', kwh: [0.035, 0.08, 0.2],
    note: 'Data centres, networks and viewing device; a big TV is at the high end, a phone at the low end.',
    src: [['IEA (2020), The carbon footprint of streaming video', 'https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines']] },
  { id: 'phone-charge', cat: 'Tech', item: 'Phone charge', icon: 'battery-charging', name: 'Full phone charge (0 → 100%)', kwh: [0.015, 0.023, 0.03],
    note: '5,000 mAh battery at 3.85 V ≈ 19 Wh, divided by ~85% charger efficiency.', src: [['Arithmetic from typical battery capacities', null]] },
  { id: 'ai-image', cat: 'Tech', item: 'AI image', icon: 'image', name: 'AI-generated image', kwh: [0.0005, 0.003, 0.012],
    note: 'Average across image models of ~2.9 kWh per 1,000 images. Electricity only.',
    src: [['Luccioni et al. (2023), Power Hungry Processing', 'https://arxiv.org/abs/2311.16863']] },
  { id: 'ai-prompt', cat: 'Tech', item: 'AI prompt', icon: 'message-square', name: 'AI text prompt', kwh: [0.0002, 0.0003, 0.003],
    note: '0.24–0.3 Wh for a typical prompt; long reasoning prompts can use 10× more. Electricity only, excludes hardware manufacture.',
    src: [['Epoch AI (2025), How much energy does ChatGPT use?', 'https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use'],
          ['Google (2025), Measuring the environmental impact of AI inference', 'https://arxiv.org/abs/2508.15734']] },
  { id: 'web-search', cat: 'Tech', item: 'Search', icon: 'search', name: 'Web search', kwh: [0.0002, 0.0003, 0.0005],
    note: 'Google’s own 2009 figure of 0.3 Wh per search; dated.',
    src: [['Google Official Blog (2009), Powering a Google search', 'https://googleblog.blogspot.com/2009/01/powering-google-search.html']] },
  { id: 'email', cat: 'Tech', item: 'Email', icon: 'mail', name: 'Short email', g: [0.03, 0.3, 17],
    note: 'Spam ≈ 0.03 g, short email ≈ 0.3 g, long email with attachment ≈ 17 g.', src: [BANANAS] },

  // Home
  { id: 'dryer', cat: 'Home', item: 'Tumble dry', icon: 'wind', name: 'Tumble dryer load', kwh: [1.5, 2.5, 4.5],
    note: 'Heat-pump dryer → old vented dryer.', src: [['Arithmetic from EU energy label ratings', null]] },
  { id: 'shower', cat: 'Home', item: 'Shower', icon: 'shower-head', name: '10-min electric shower', kwh: [0.8, 1.5, 1.8],
    note: '7.5–10.5 kW electric shower. A gas boiler shower is similar or higher.', src: [['Arithmetic from typical shower power ratings', null]] },
  { id: 'laundry', cat: 'Home', item: 'Laundry', icon: 'washing-machine', name: 'Washing machine load', kwh: [0.3, 0.6, 1.2],
    note: '30 °C eco → 60 °C wash.', src: [['Arithmetic from EU energy label ratings', null]] },
  { id: 'kettle', cat: 'Home', item: 'Kettle', icon: 'flame', name: 'Boiling a full kettle (1 L)', kwh: [0.05, 0.1, 0.17],
    note: 'Heating 1 L of water from 15 °C to 100 °C takes ~0.1 kWh.', src: [['Arithmetic from water’s heat capacity', null]] },
  { id: 'led', cat: 'Home', item: 'Light/h', icon: 'lightbulb', name: 'LED bulb for an hour', kwh: [0.005, 0.01, 0.015],
    note: '5–15 W bulb.', src: [['Arithmetic from bulb wattage', null]] },

  // Clothes
  { id: 'jeans', cat: 'Clothes', item: 'Jeans', icon: 'shirt', name: 'Pair of jeans', g: [15000, 33000, 45000],
    note: 'Full life cycle including washing.', src: [['Levi Strauss & Co. (2015), Product life cycle assessment', 'https://www.levistrauss.com/sustainability-report/']] },
  { id: 'trainers', cat: 'Clothes', item: 'Trainers', icon: 'footprints', name: 'Pair of running shoes', g: [10000, 14000, 20000],
    note: 'About two-thirds of it from manufacturing.', src: [['Cheah et al. (2013), MIT life-cycle study of a running shoe', null]] },
  { id: 't-shirt', cat: 'Clothes', item: 'T-shirt', icon: 'shirt', name: 'Cotton T-shirt', g: [2000, 6000, 15000],
    note: 'Production through end of life; varies with cotton source and washing.', src: [BANANAS] },

  // Disposables
  { id: 'water-bottle', cat: 'Disposables', item: 'Water bottle', icon: 'glass-water', name: 'Bottled water (500 ml)', g: [50, 80, 160],
    note: 'PET bottle, filling and distribution.', src: [BANANAS] },
  { id: 'paper-cup', cat: 'Disposables', item: 'Coffee cup', icon: 'cup-soda', name: 'Disposable coffee cup', g: [10, 20, 40],
    note: 'Paper cup with plastic lining and lid.', src: [BANANAS] },
  { id: 'plastic-bag', cat: 'Disposables', item: 'Plastic bag', icon: 'shopping-bag', name: 'Plastic carrier bag', g: [3, 10, 50],
    note: 'Lightweight single-use bag ≈ 10 g; heavy “bag for life” ≈ 50 g.', src: [BANANAS] },
  { id: 'paper-towel', cat: 'Disposables', item: 'Paper towel', icon: 'scroll', name: 'Paper towel (1 sheet)', g: [5, 10, 20],
    note: 'One sheet.', src: [BANANAS] },
  { id: 'a4-sheet', cat: 'Disposables', item: 'A4 sheet', icon: 'file', name: 'Sheet of A4 paper', g: [2.5, 4.6, 10],
    note: '5 g sheet at ~0.92 kg CO2e per kg of paper. Recycled paper is at the low end.', src: [DESNZ] },
  { id: 'receipt', cat: 'Disposables', item: 'Receipt', icon: 'receipt', name: 'Till receipt', g: [2, 4, 8],
    note: 'About 3 g of thermal paper.', src: [DESNZ] },
  { id: 'tissue', cat: 'Disposables', item: 'Tissue', icon: 'sticky-note', name: 'Tissue', g: [1, 3, 6],
    note: 'About 1.5 g of tissue paper at 1–3 kg CO2e per kg.', src: [DESNZ] },

  // Other
  { id: 'person-year', cat: 'Other', item: 'Person/year', icon: 'user', name: 'One person’s emissions for a year (world average)', g: [4700000, 6500000, 6600000],
    note: '4.7 t of fossil CO2 alone; ~6.5 t including all greenhouse gases and land use.',
    src: [['Our World in Data, CO2 and greenhouse gas emissions', 'https://ourworldindata.org/co2-and-greenhouse-gas-emissions']] },
];
