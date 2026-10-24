/**
 * Reference data (production): Egyptian governorates and common makes/models.
 * Loaded idempotently by `npm run db:seed:reference`. Extend freely — rows are
 * matched by slug, never deleted.
 */
type Body = "sedan" | "hatchback" | "suv" | "crossover" | "pickup" | "van" | "coupe" | "convertible" | "wagon";

export const CITIES: { id: number; slug: string; nameEn: string; nameAr: string; isLaunch?: boolean; sortOrder: number }[] = [
  { id: 1, slug: "alexandria", nameEn: "Alexandria", nameAr: "الإسكندرية", isLaunch: true, sortOrder: 1 },
  { id: 2, slug: "cairo", nameEn: "Cairo", nameAr: "القاهرة", sortOrder: 2 },
  { id: 3, slug: "giza", nameEn: "Giza", nameAr: "الجيزة", sortOrder: 3 },
  { id: 4, slug: "beheira", nameEn: "Beheira", nameAr: "البحيرة", sortOrder: 10 },
  { id: 5, slug: "matrouh", nameEn: "Matrouh", nameAr: "مطروح", sortOrder: 10 },
  { id: 6, slug: "gharbia", nameEn: "Gharbia", nameAr: "الغربية", sortOrder: 10 },
  { id: 7, slug: "kafr-el-sheikh", nameEn: "Kafr El Sheikh", nameAr: "كفر الشيخ", sortOrder: 10 },
  { id: 8, slug: "dakahlia", nameEn: "Dakahlia", nameAr: "الدقهلية", sortOrder: 10 },
  { id: 9, slug: "damietta", nameEn: "Damietta", nameAr: "دمياط", sortOrder: 10 },
  { id: 10, slug: "sharqia", nameEn: "Sharqia", nameAr: "الشرقية", sortOrder: 10 },
  { id: 11, slug: "qalyubia", nameEn: "Qalyubia", nameAr: "القليوبية", sortOrder: 10 },
  { id: 12, slug: "monufia", nameEn: "Monufia", nameAr: "المنوفية", sortOrder: 10 },
  { id: 13, slug: "port-said", nameEn: "Port Said", nameAr: "بورسعيد", sortOrder: 10 },
  { id: 14, slug: "ismailia", nameEn: "Ismailia", nameAr: "الإسماعيلية", sortOrder: 10 },
  { id: 15, slug: "suez", nameEn: "Suez", nameAr: "السويس", sortOrder: 10 },
  { id: 16, slug: "faiyum", nameEn: "Faiyum", nameAr: "الفيوم", sortOrder: 10 },
  { id: 17, slug: "beni-suef", nameEn: "Beni Suef", nameAr: "بني سويف", sortOrder: 10 },
  { id: 18, slug: "minya", nameEn: "Minya", nameAr: "المنيا", sortOrder: 10 },
  { id: 19, slug: "asyut", nameEn: "Asyut", nameAr: "أسيوط", sortOrder: 10 },
  { id: 20, slug: "sohag", nameEn: "Sohag", nameAr: "سوهاج", sortOrder: 10 },
  { id: 21, slug: "qena", nameEn: "Qena", nameAr: "قنا", sortOrder: 10 },
  { id: 22, slug: "luxor", nameEn: "Luxor", nameAr: "الأقصر", sortOrder: 10 },
  { id: 23, slug: "aswan", nameEn: "Aswan", nameAr: "أسوان", sortOrder: 10 },
  { id: 24, slug: "red-sea", nameEn: "Red Sea", nameAr: "البحر الأحمر", sortOrder: 10 },
  { id: 25, slug: "new-valley", nameEn: "New Valley", nameAr: "الوادي الجديد", sortOrder: 10 },
  { id: 26, slug: "north-sinai", nameEn: "North Sinai", nameAr: "شمال سيناء", sortOrder: 10 },
  { id: 27, slug: "south-sinai", nameEn: "South Sinai", nameAr: "جنوب سيناء", sortOrder: 10 },
];

type ModelDef = [slug: string, nameEn: string, nameAr: string, body: Body];

export const MAKES: { slug: string; nameEn: string; nameAr: string; popular?: boolean; models: ModelDef[] }[] = [
  {
    slug: "toyota", nameEn: "Toyota", nameAr: "تويوتا", popular: true,
    models: [
      ["corolla", "Corolla", "كورولا", "sedan"], ["yaris", "Yaris", "ياريس", "hatchback"],
      ["c-hr", "C-HR", "سي إتش آر", "crossover"], ["rav4", "RAV4", "راف فور", "suv"],
      ["fortuner", "Fortuner", "فورتشنر", "suv"], ["hilux", "Hilux", "هايلكس", "pickup"],
      ["camry", "Camry", "كامري", "sedan"], ["land-cruiser", "Land Cruiser", "لاند كروزر", "suv"],
    ],
  },
  {
    slug: "hyundai", nameEn: "Hyundai", nameAr: "هيونداي", popular: true,
    models: [
      ["elantra", "Elantra", "إلنترا", "sedan"], ["accent", "Accent", "أكسنت", "sedan"],
      ["verna", "Verna", "فيرنا", "sedan"], ["i10", "i10", "آي 10", "hatchback"],
      ["tucson", "Tucson", "توسان", "suv"], ["creta", "Creta", "كريتا", "crossover"],
      ["bayon", "Bayon", "بايون", "crossover"], ["santa-fe", "Santa Fe", "سانتا في", "suv"],
    ],
  },
  {
    slug: "kia", nameEn: "Kia", nameAr: "كيا", popular: true,
    models: [
      ["cerato", "Cerato", "سيراتو", "sedan"], ["pegas", "Pegas", "بيجاس", "sedan"],
      ["picanto", "Picanto", "بيكانتو", "hatchback"], ["rio", "Rio", "ريو", "hatchback"],
      ["sportage", "Sportage", "سبورتاج", "suv"], ["seltos", "Seltos", "سيلتوس", "crossover"],
      ["sorento", "Sorento", "سورينتو", "suv"],
    ],
  },
  {
    slug: "nissan", nameEn: "Nissan", nameAr: "نيسان", popular: true,
    models: [
      ["sunny", "Sunny", "صني", "sedan"], ["sentra", "Sentra", "سنترا", "sedan"],
      ["qashqai", "Qashqai", "قاشقاي", "crossover"], ["juke", "Juke", "جوك", "crossover"],
      ["x-trail", "X-Trail", "إكس تريل", "suv"],
    ],
  },
  {
    slug: "chevrolet", nameEn: "Chevrolet", nameAr: "شيفروليه", popular: true,
    models: [
      ["optra", "Optra", "أوبترا", "sedan"], ["aveo", "Aveo", "أفيو", "sedan"],
      ["lanos", "Lanos", "لانوس", "sedan"], ["cruze", "Cruze", "كروز", "sedan"],
      ["captiva", "Captiva", "كابتيفا", "suv"],
    ],
  },
  {
    slug: "mg", nameEn: "MG", nameAr: "إم جي", popular: true,
    models: [
      ["zs", "ZS", "زد إس", "crossover"], ["mg5", "MG5", "إم جي 5", "sedan"],
      ["mg6", "MG6", "إم جي 6", "sedan"], ["rx5", "RX5", "آر إكس 5", "suv"], ["hs", "HS", "إتش إس", "suv"],
    ],
  },
  {
    slug: "chery", nameEn: "Chery", nameAr: "شيري", popular: true,
    models: [
      ["tiggo-4", "Tiggo 4", "تيجو 4", "crossover"], ["tiggo-7", "Tiggo 7", "تيجو 7", "suv"],
      ["tiggo-8", "Tiggo 8", "تيجو 8", "suv"], ["arrizo-5", "Arrizo 5", "أريزو 5", "sedan"],
    ],
  },
  {
    slug: "renault", nameEn: "Renault", nameAr: "رينو", popular: true,
    models: [
      ["logan", "Logan", "لوجان", "sedan"], ["sandero", "Sandero", "سانديرو", "hatchback"],
      ["duster", "Duster", "داستر", "suv"], ["megane", "Megane", "ميجان", "sedan"],
      ["kadjar", "Kadjar", "كادجار", "crossover"],
    ],
  },
  {
    slug: "peugeot", nameEn: "Peugeot", nameAr: "بيجو", popular: true,
    models: [
      ["301", "301", "301", "sedan"], ["2008", "2008", "2008", "crossover"],
      ["3008", "3008", "3008", "suv"], ["5008", "5008", "5008", "suv"], ["508", "508", "508", "sedan"],
    ],
  },
  {
    slug: "skoda", nameEn: "Skoda", nameAr: "سكودا", popular: true,
    models: [
      ["octavia", "Octavia", "أوكتافيا", "sedan"], ["kamiq", "Kamiq", "كاميك", "crossover"],
      ["karoq", "Karoq", "كاروك", "suv"], ["kodiaq", "Kodiaq", "كودياك", "suv"], ["fabia", "Fabia", "فابيا", "hatchback"],
    ],
  },
  {
    slug: "mitsubishi", nameEn: "Mitsubishi", nameAr: "ميتسوبيشي",
    models: [
      ["lancer", "Lancer", "لانسر", "sedan"], ["attrage", "Attrage", "أتراج", "sedan"],
      ["eclipse-cross", "Eclipse Cross", "إكليبس كروس", "crossover"], ["pajero", "Pajero", "باجيرو", "suv"],
      ["xpander", "Xpander", "إكسباندر", "van"],
    ],
  },
  {
    slug: "suzuki", nameEn: "Suzuki", nameAr: "سوزوكي",
    models: [
      ["swift", "Swift", "سويفت", "hatchback"], ["dzire", "Dzire", "ديزاير", "sedan"],
      ["ciaz", "Ciaz", "سياز", "sedan"], ["ertiga", "Ertiga", "إرتيجا", "van"], ["vitara", "Vitara", "فيتارا", "suv"],
    ],
  },
  {
    slug: "honda", nameEn: "Honda", nameAr: "هوندا",
    models: [["civic", "Civic", "سيفيك", "sedan"], ["city", "City", "سيتي", "sedan"], ["cr-v", "CR-V", "سي آر في", "suv"]],
  },
  {
    slug: "mercedes-benz", nameEn: "Mercedes-Benz", nameAr: "مرسيدس بنز",
    models: [
      ["a-class", "A-Class", "A-Class", "sedan"], ["c-class", "C-Class", "C-Class", "sedan"],
      ["e-class", "E-Class", "E-Class", "sedan"], ["glc", "GLC", "GLC", "suv"],
    ],
  },
  {
    slug: "bmw", nameEn: "BMW", nameAr: "بي إم دبليو",
    models: [["3-series", "3 Series", "الفئة الثالثة", "sedan"], ["5-series", "5 Series", "الفئة الخامسة", "sedan"], ["x3", "X3", "X3", "suv"], ["x5", "X5", "X5", "suv"]],
  },
  {
    slug: "volkswagen", nameEn: "Volkswagen", nameAr: "فولكس فاجن",
    models: [["passat", "Passat", "باسات", "sedan"], ["golf", "Golf", "جولف", "hatchback"], ["tiguan", "Tiguan", "تيجوان", "suv"], ["polo", "Polo", "بولو", "hatchback"]],
  },
  {
    slug: "fiat", nameEn: "Fiat", nameAr: "فيات",
    models: [["tipo", "Tipo", "تيبو", "sedan"], ["500", "500", "500", "hatchback"], ["128", "128", "128", "sedan"]],
  },
  {
    slug: "byd", nameEn: "BYD", nameAr: "بي واي دي",
    models: [["f3", "F3", "F3", "sedan"], ["song-plus", "Song Plus", "سونج بلس", "suv"], ["atto-3", "Atto 3", "أتو 3", "crossover"]],
  },
  {
    slug: "geely", nameEn: "Geely", nameAr: "جيلي",
    models: [["emgrand", "Emgrand", "إمجراند", "sedan"], ["coolray", "Coolray", "كولراي", "crossover"], ["tugella", "Tugella", "توجيلا", "suv"]],
  },
  {
    slug: "jeep", nameEn: "Jeep", nameAr: "جيب",
    models: [["renegade", "Renegade", "رينيجيد", "crossover"], ["compass", "Compass", "كومباس", "suv"], ["grand-cherokee", "Grand Cherokee", "جراند شيروكي", "suv"]],
  },
];
