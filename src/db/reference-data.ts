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
type MakeDef = { slug: string; nameEn: string; nameAr: string; popular?: boolean; models: ModelDef[] };

// Compact helper: [slug, English name, body]; Arabic name defaults to the English name.
const m = (list: [string, string, Body, string?][]): ModelDef[] => list.map(([slug, en, body, ar]) => [slug, en, ar ?? en, body]);

/**
 * Makes and models sold new or common on the used market in Egypt.
 * Sellers can still enter an unlisted model; it is created as unverified
 * and approved by an admin with the listing.
 */
export const MAKES: MakeDef[] = [
  { slug: "toyota", nameEn: "Toyota", nameAr: "تويوتا", popular: true, models: m([
    ["corolla", "Corolla", "sedan", "كورولا"], ["corolla-cross", "Corolla Cross", "crossover", "كورولا كروس"], ["yaris", "Yaris", "hatchback", "ياريس"],
    ["yaris-sedan", "Yaris Sedan", "sedan", "ياريس سيدان"], ["belta", "Belta", "sedan", "بلتا"], ["rumion", "Rumion", "van", "روميون"], ["avanza", "Avanza", "van", "أفانزا"],
    ["veloz", "Veloz", "van", "فيلوز"], ["rush", "Rush", "suv", "راش"], ["raize", "Raize", "crossover", "رايز"], ["c-hr", "C-HR", "crossover", "سي إتش آر"],
    ["rav4", "RAV4", "suv", "راف فور"], ["fortuner", "Fortuner", "suv", "فورتشنر"], ["hilux", "Hilux", "pickup", "هايلكس"], ["camry", "Camry", "sedan", "كامري"],
    ["prado", "Land Cruiser Prado", "suv", "برادو"], ["land-cruiser", "Land Cruiser", "suv", "لاند كروزر"], ["hiace", "Hiace", "van", "هاي إس"],
    ["chr-hybrid", "C-HR Hybrid", "crossover"], ["prius", "Prius", "hatchback", "بريوس"], ["auris", "Auris", "hatchback", "أوريس"], ["echo", "Echo", "sedan", "إيكو"],
  ]) },
  { slug: "hyundai", nameEn: "Hyundai", nameAr: "هيونداي", popular: true, models: m([
    ["elantra", "Elantra", "sedan", "إلنترا"], ["elantra-hd", "Elantra HD", "sedan", "إلنترا HD"], ["elantra-ad", "Elantra AD", "sedan", "إلنترا AD"], ["elantra-cn7", "Elantra CN7", "sedan", "إلنترا CN7"],
    ["accent", "Accent", "sedan", "أكسنت"], ["accent-rb", "Accent RB", "sedan", "أكسنت RB"], ["verna", "Verna", "sedan", "فيرنا"], ["i10", "i10", "hatchback", "آي 10"],
    ["grand-i10", "Grand i10", "hatchback", "جراند آي 10"], ["i20", "i20", "hatchback", "آي 20"], ["i30", "i30", "hatchback", "آي 30"], ["matrix", "Matrix", "van", "ماتريكس"],
    ["getz", "Getz", "hatchback", "جيتز"], ["tucson", "Tucson", "suv", "توسان"], ["creta", "Creta", "crossover", "كريتا"], ["bayon", "Bayon", "crossover", "بايون"],
    ["venue", "Venue", "crossover", "فينيو"], ["kona", "Kona", "crossover", "كونا"], ["santa-fe", "Santa Fe", "suv", "سانتا في"], ["sonata", "Sonata", "sedan", "سوناتا"],
    ["azera", "Azera", "sedan", "أزيرا"], ["staria", "Staria", "van", "ستاريا"], ["h1", "H-1", "van", "H1"], ["ioniq-5", "Ioniq 5", "crossover", "أيونيك 5"],
  ]) },
  { slug: "kia", nameEn: "Kia", nameAr: "كيا", popular: true, models: m([
    ["cerato", "Cerato", "sedan", "سيراتو"], ["k3", "K3", "sedan"], ["k5", "K5", "sedan"], ["pegas", "Pegas", "sedan", "بيجاس"], ["picanto", "Picanto", "hatchback", "بيكانتو"],
    ["rio", "Rio", "hatchback", "ريو"], ["soul", "Soul", "crossover", "سول"], ["sportage", "Sportage", "suv", "سبورتاج"], ["seltos", "Seltos", "crossover", "سيلتوس"],
    ["sonet", "Sonet", "crossover", "سونيت"], ["xceed", "XCeed", "crossover", "إكسيد"], ["sorento", "Sorento", "suv", "سورينتو"], ["carens", "Carens", "van", "كارينز"],
    ["carnival", "Carnival", "van", "كرنفال"], ["optima", "Optima", "sedan", "أوبتيما"], ["spectra", "Spectra", "sedan", "سبكترا"], ["ev6", "EV6", "crossover"],
  ]) },
  { slug: "nissan", nameEn: "Nissan", nameAr: "نيسان", popular: true, models: m([
    ["sunny", "Sunny", "sedan", "صني"], ["sentra", "Sentra", "sedan", "سنترا"], ["tiida", "Tiida", "hatchback", "تيدا"], ["micra", "Micra", "hatchback", "ميكرا"],
    ["qashqai", "Qashqai", "crossover", "قاشقاي"], ["juke", "Juke", "crossover", "جوك"], ["kicks", "Kicks", "crossover", "كيكس"], ["x-trail", "X-Trail", "suv", "إكس تريل"],
    ["patrol", "Patrol", "suv", "باترول"], ["navara", "Navara", "pickup", "نافارا"], ["pickup", "Pick-up", "pickup", "بيك أب"], ["altima", "Altima", "sedan", "ألتيما"],
    ["maxima", "Maxima", "sedan", "ماكسيما"], ["urvan", "Urvan", "van", "أورفان"],
  ]) },
  { slug: "chevrolet", nameEn: "Chevrolet", nameAr: "شيفروليه", popular: true, models: m([
    ["optra", "Optra", "sedan", "أوبترا"], ["aveo", "Aveo", "sedan", "أفيو"], ["lanos", "Lanos", "sedan", "لانوس"], ["cruze", "Cruze", "sedan", "كروز"],
    ["spark", "Spark", "hatchback", "سبارك"], ["captiva", "Captiva", "suv", "كابتيفا"], ["groove", "Groove", "crossover", "جروف"], ["trax", "Trax", "crossover", "تراكس"],
    ["malibu", "Malibu", "sedan", "ماليبو"], ["tahoe", "Tahoe", "suv", "تاهو"], ["n300", "N300", "van"], ["t-series", "T-Series", "pickup"], ["dmax", "D-Max", "pickup", "دي ماكس"],
  ]) },
  { slug: "mg", nameEn: "MG", nameAr: "إم جي", popular: true, models: m([
    ["zs", "ZS", "crossover", "زد إس"], ["zs-ev", "ZS EV", "crossover"], ["mg3", "MG3", "hatchback", "إم جي 3"], ["mg4", "MG4", "hatchback", "إم جي 4"], ["mg5", "MG5", "sedan", "إم جي 5"],
    ["mg6", "MG6", "sedan", "إم جي 6"], ["mg7", "MG7", "sedan", "إم جي 7"], ["gt", "GT", "sedan"], ["rx5", "RX5", "suv", "آر إكس 5"], ["rx8", "RX8", "suv", "آر إكس 8"],
    ["hs", "HS", "suv", "إتش إس"], ["one", "One", "crossover", "وان"], ["whale", "Whale", "crossover"],
  ]) },
  { slug: "chery", nameEn: "Chery", nameAr: "شيري", popular: true, models: m([
    ["tiggo-2", "Tiggo 2", "crossover", "تيجو 2"], ["tiggo-3", "Tiggo 3", "crossover", "تيجو 3"], ["tiggo-4", "Tiggo 4", "crossover", "تيجو 4"], ["tiggo-4-pro", "Tiggo 4 Pro", "crossover", "تيجو 4 برو"],
    ["tiggo-7", "Tiggo 7", "suv", "تيجو 7"], ["tiggo-7-pro", "Tiggo 7 Pro", "suv", "تيجو 7 برو"], ["tiggo-8", "Tiggo 8", "suv", "تيجو 8"], ["tiggo-8-pro", "Tiggo 8 Pro", "suv", "تيجو 8 برو"],
    ["arrizo-5", "Arrizo 5", "sedan", "أريزو 5"], ["arrizo-6", "Arrizo 6", "sedan", "أريزو 6"], ["envy", "Envy", "sedan", "إنفي"], ["a11", "A11", "sedan"], ["a15", "A15", "sedan"],
  ]) },
  { slug: "renault", nameEn: "Renault", nameAr: "رينو", popular: true, models: m([
    ["logan", "Logan", "sedan", "لوجان"], ["sandero", "Sandero", "hatchback", "سانديرو"], ["sandero-stepway", "Sandero Stepway", "hatchback", "سانديرو ستيب واي"],
    ["duster", "Duster", "suv", "داستر"], ["megane", "Megane", "sedan", "ميجان"], ["fluence", "Fluence", "sedan", "فلوانس"], ["kadjar", "Kadjar", "crossover", "كادجار"],
    ["austral", "Austral", "crossover", "أوسترال"], ["captur", "Captur", "crossover", "كابتشر"], ["clio", "Clio", "hatchback", "كليو"], ["taliant", "Taliant", "sedan", "تاليانت"], ["koleos", "Koleos", "suv", "كوليوس"],
  ]) },
  { slug: "peugeot", nameEn: "Peugeot", nameAr: "بيجو", popular: true, models: m([
    ["208", "208", "hatchback"], ["301", "301", "sedan"], ["308", "308", "hatchback"], ["408", "408", "sedan"], ["508", "508", "sedan"], ["2008", "2008", "crossover"],
    ["3008", "3008", "suv"], ["5008", "5008", "suv"], ["405", "405", "sedan"], ["406", "406", "sedan"], ["206", "206", "hatchback"], ["207", "207", "hatchback"], ["partner", "Partner", "van", "بارتنر"],
  ]) },
  { slug: "skoda", nameEn: "Skoda", nameAr: "سكودا", popular: true, models: m([
    ["octavia", "Octavia", "sedan", "أوكتافيا"], ["fabia", "Fabia", "hatchback", "فابيا"], ["rapid", "Rapid", "sedan", "رابيد"], ["scala", "Scala", "hatchback", "سكالا"],
    ["superb", "Superb", "sedan", "سوبيرب"], ["kamiq", "Kamiq", "crossover", "كاميك"], ["karoq", "Karoq", "suv", "كاروك"], ["kodiaq", "Kodiaq", "suv", "كودياك"], ["roomster", "Roomster", "van", "رومستر"],
  ]) },
  { slug: "mitsubishi", nameEn: "Mitsubishi", nameAr: "ميتسوبيشي", models: m([
    ["lancer", "Lancer", "sedan", "لانسر"], ["lancer-shark", "Lancer Shark", "sedan", "لانسر شارك"], ["attrage", "Attrage", "sedan", "أتراج"], ["mirage", "Mirage", "hatchback", "ميراج"],
    ["eclipse-cross", "Eclipse Cross", "crossover", "إكليبس كروس"], ["asx", "ASX", "crossover"], ["outlander", "Outlander", "suv", "أوتلاندر"], ["pajero", "Pajero", "suv", "باجيرو"],
    ["pajero-sport", "Pajero Sport", "suv", "باجيرو سبورت"], ["xpander", "Xpander", "van", "إكسباندر"], ["l200", "L200", "pickup"],
  ]) },
  { slug: "suzuki", nameEn: "Suzuki", nameAr: "سوزوكي", models: m([
    ["swift", "Swift", "hatchback", "سويفت"], ["dzire", "Dzire", "sedan", "ديزاير"], ["ciaz", "Ciaz", "sedan", "سياز"], ["alto", "Alto", "hatchback", "ألتو"],
    ["celerio", "Celerio", "hatchback", "سيليريو"], ["baleno", "Baleno", "hatchback", "بالينو"], ["ertiga", "Ertiga", "van", "إرتيجا"], ["xl7", "XL7", "van"],
    ["vitara", "Vitara", "suv", "فيتارا"], ["grand-vitara", "Grand Vitara", "suv", "جراند فيتارا"], ["s-presso", "S-Presso", "hatchback", "إس بريسو"], ["jimny", "Jimny", "suv", "جيمني"], ["fronx", "Fronx", "crossover", "فرونكس"], ["apv", "APV", "van"],
  ]) },
  { slug: "honda", nameEn: "Honda", nameAr: "هوندا", models: m([
    ["civic", "Civic", "sedan", "سيفيك"], ["city", "City", "sedan", "سيتي"], ["accord", "Accord", "sedan", "أكورد"], ["jazz", "Jazz", "hatchback", "جاز"],
    ["hr-v", "HR-V", "crossover"], ["cr-v", "CR-V", "suv", "سي آر في"], ["zr-v", "ZR-V", "crossover"], ["pilot", "Pilot", "suv", "بايلوت"],
  ]) },
  { slug: "mercedes-benz", nameEn: "Mercedes-Benz", nameAr: "مرسيدس بنز", models: m([
    ["a-class", "A-Class", "hatchback"], ["c-class", "C-Class", "sedan"], ["e-class", "E-Class", "sedan"], ["s-class", "S-Class", "sedan"], ["cla", "CLA", "sedan"],
    ["cls", "CLS", "sedan"], ["gla", "GLA", "crossover"], ["glb", "GLB", "suv"], ["glc", "GLC", "suv"], ["glc-coupe", "GLC Coupe", "suv"], ["gle", "GLE", "suv"],
    ["gls", "GLS", "suv"], ["g-class", "G-Class", "suv"], ["eqa", "EQA", "crossover"], ["eqb", "EQB", "suv"], ["eqe", "EQE", "sedan"], ["eqs", "EQS", "sedan"], ["v-class", "V-Class", "van"], ["vito", "Vito", "van"], ["sprinter", "Sprinter", "van"],
  ]) },
  { slug: "bmw", nameEn: "BMW", nameAr: "بي إم دبليو", models: m([
    ["1-series", "1 Series", "hatchback", "الفئة الأولى"], ["2-series", "2 Series", "coupe", "الفئة الثانية"], ["2-series-gran-coupe", "2 Series Gran Coupe", "sedan"], ["3-series", "3 Series", "sedan", "الفئة الثالثة"],
    ["4-series", "4 Series", "coupe", "الفئة الرابعة"], ["5-series", "5 Series", "sedan", "الفئة الخامسة"], ["6-series", "6 Series", "coupe", "الفئة السادسة"], ["7-series", "7 Series", "sedan", "الفئة السابعة"],
    ["8-series", "8 Series", "coupe", "الفئة الثامنة"], ["x1", "X1", "crossover"], ["x2", "X2", "crossover"], ["x3", "X3", "suv"], ["x4", "X4", "suv"], ["x5", "X5", "suv"],
    ["x6", "X6", "suv"], ["x7", "X7", "suv"], ["xm", "XM", "suv"], ["z4", "Z4", "convertible"], ["i3", "i3", "hatchback"], ["i4", "i4", "sedan"], ["i5", "i5", "sedan"],
    ["i7", "i7", "sedan"], ["ix", "iX", "suv"], ["ix1", "iX1", "crossover"], ["ix3", "iX3", "suv"], ["m2", "M2", "coupe"], ["m3", "M3", "sedan"], ["m4", "M4", "coupe"], ["m5", "M5", "sedan"],
  ]) },
  { slug: "audi", nameEn: "Audi", nameAr: "أودي", models: m([
    ["a1", "A1", "hatchback"], ["a3", "A3", "sedan"], ["a4", "A4", "sedan"], ["a5", "A5", "coupe"], ["a6", "A6", "sedan"], ["a7", "A7", "sedan"], ["a8", "A8", "sedan"],
    ["q2", "Q2", "crossover"], ["q3", "Q3", "suv"], ["q5", "Q5", "suv"], ["q7", "Q7", "suv"], ["q8", "Q8", "suv"], ["e-tron", "e-tron", "suv"], ["q4-e-tron", "Q4 e-tron", "suv"], ["tt", "TT", "coupe"],
  ]) },
  { slug: "volkswagen", nameEn: "Volkswagen", nameAr: "فولكس فاجن", models: m([
    ["passat", "Passat", "sedan", "باسات"], ["golf", "Golf", "hatchback", "جولف"], ["polo", "Polo", "hatchback", "بولو"], ["jetta", "Jetta", "sedan", "جيتا"],
    ["tiguan", "Tiguan", "suv", "تيجوان"], ["t-roc", "T-Roc", "crossover", "تي روك"], ["t-cross", "T-Cross", "crossover", "تي كروس"], ["touareg", "Touareg", "suv", "طوارق"],
    ["teramont", "Teramont", "suv", "تيرامونت"], ["id4", "ID.4", "crossover"], ["id6", "ID.6", "suv"], ["caddy", "Caddy", "van", "كادي"], ["transporter", "Transporter", "van"],
  ]) },
  { slug: "fiat", nameEn: "Fiat", nameAr: "فيات", models: m([
    ["tipo", "Tipo", "sedan", "تيبو"], ["500", "500", "hatchback"], ["500x", "500X", "crossover"], ["128", "128", "sedan"], ["127", "127", "hatchback"], ["punto", "Punto", "hatchback", "بونتو"],
    ["linea", "Linea", "sedan", "لينيا"], ["shahin", "Shahin (Şahin)", "sedan", "شاهين"], ["uno", "Uno", "hatchback", "أونو"], ["siena", "Siena", "sedan", "سيينا"], ["doblo", "Doblo", "van", "دوبلو"], ["ducato", "Ducato", "van", "دوكاتو"],
  ]) },
  { slug: "byd", nameEn: "BYD", nameAr: "بي واي دي", models: m([
    ["f3", "F3", "sedan"], ["f0", "F0", "hatchback"], ["l3", "L3", "sedan"], ["seal", "Seal", "sedan", "سيل"], ["seagull", "Seagull", "hatchback", "سيجال"], ["dolphin", "Dolphin", "hatchback", "دولفين"],
    ["song-plus", "Song Plus", "suv", "سونج بلس"], ["song-l", "Song L", "suv"], ["atto-3", "Atto 3", "crossover", "أتو 3"], ["qin-plus", "Qin Plus", "sedan", "تشين بلس"], ["han", "Han", "sedan", "هان"], ["tang", "Tang", "suv", "تانج"], ["yuan-plus", "Yuan Plus", "crossover"],
  ]) },
  { slug: "geely", nameEn: "Geely", nameAr: "جيلي", models: m([
    ["emgrand", "Emgrand", "sedan", "إمجراند"], ["emgrand-7", "Emgrand 7", "sedan", "إمجراند 7"], ["pandino", "Pandino", "hatchback", "باندينو"], ["coolray", "Coolray", "crossover", "كولراي"],
    ["tugella", "Tugella", "suv", "توجيلا"], ["okavango", "Okavango", "suv", "أوكافانجو"], ["monjaro", "Monjaro", "suv", "مونجارو"], ["geometry-c", "Geometry C", "hatchback"], ["gx3", "GX3", "crossover"],
  ]) },
  { slug: "jeep", nameEn: "Jeep", nameAr: "جيب", models: m([
    ["renegade", "Renegade", "crossover", "رينيجيد"], ["compass", "Compass", "suv", "كومباس"], ["cherokee", "Cherokee", "suv", "شيروكي"], ["grand-cherokee", "Grand Cherokee", "suv", "جراند شيروكي"],
    ["wrangler", "Wrangler", "suv", "رانجلر"], ["gladiator", "Gladiator", "pickup", "جلاديتور"],
  ]) },
  { slug: "opel", nameEn: "Opel", nameAr: "أوبل", models: m([
    ["astra", "Astra", "hatchback", "أسترا"], ["corsa", "Corsa", "hatchback", "كورسا"], ["insignia", "Insignia", "sedan", "إنسيجنيا"], ["vectra", "Vectra", "sedan", "فيكترا"],
    ["mokka", "Mokka", "crossover", "موكا"], ["crossland", "Crossland", "crossover", "كروس لاند"], ["grandland", "Grandland", "suv", "جراند لاند"], ["combo", "Combo", "van", "كومبو"],
  ]) },
  { slug: "seat", nameEn: "Seat", nameAr: "سيات", models: m([
    ["ibiza", "Ibiza", "hatchback", "إبيزا"], ["leon", "Leon", "hatchback", "ليون"], ["toledo", "Toledo", "sedan", "توليدو"], ["arona", "Arona", "crossover", "أرونا"], ["ateca", "Ateca", "suv", "أتيكا"], ["tarraco", "Tarraco", "suv", "تاراكو"],
  ]) },
  { slug: "cupra", nameEn: "Cupra", nameAr: "كوبرا", models: m([["formentor", "Formentor", "crossover", "فورمنتور"], ["leon", "Leon", "hatchback", "ليون"], ["born", "Born", "hatchback"], ["ateca", "Ateca", "suv"]]) },
  { slug: "citroen", nameEn: "Citroën", nameAr: "ستروين", models: m([
    ["c3", "C3", "hatchback"], ["c4", "C4", "hatchback"], ["c-elysee", "C-Elysée", "sedan", "سي إليزيه"], ["c3-aircross", "C3 Aircross", "crossover"], ["c4-x", "C4 X", "sedan"], ["c5-aircross", "C5 Aircross", "suv"], ["berlingo", "Berlingo", "van", "برلينجو"],
  ]) },
  { slug: "ford", nameEn: "Ford", nameAr: "فورد", models: m([
    ["focus", "Focus", "hatchback", "فوكس"], ["fiesta", "Fiesta", "hatchback", "فييستا"], ["fusion", "Fusion", "sedan", "فيوجن"], ["mondeo", "Mondeo", "sedan", "مونديو"],
    ["ecosport", "EcoSport", "crossover", "إيكو سبورت"], ["kuga", "Kuga", "suv", "كوجا"], ["territory", "Territory", "suv", "تيريتوري"], ["explorer", "Explorer", "suv", "إكسبلورر"],
    ["everest", "Everest", "suv", "إيفرست"], ["ranger", "Ranger", "pickup", "رينجر"], ["mustang", "Mustang", "coupe", "موستانج"], ["transit", "Transit", "van", "ترانزيت"],
  ]) },
  { slug: "mazda", nameEn: "Mazda", nameAr: "مازدا", models: m([["2", "Mazda2", "hatchback"], ["3", "Mazda3", "sedan"], ["6", "Mazda6", "sedan"], ["cx-3", "CX-3", "crossover"], ["cx-30", "CX-30", "crossover"], ["cx-5", "CX-5", "suv"], ["cx-9", "CX-9", "suv"]]) },
  { slug: "subaru", nameEn: "Subaru", nameAr: "سوبارو", models: m([["impreza", "Impreza", "sedan", "إمبريزا"], ["xv", "XV", "crossover"], ["forester", "Forester", "suv", "فورستر"], ["outback", "Outback", "wagon", "أوتباك"], ["legacy", "Legacy", "sedan", "ليجاسي"]]) },
  { slug: "lexus", nameEn: "Lexus", nameAr: "لكزس", models: m([["is", "IS", "sedan"], ["es", "ES", "sedan"], ["ls", "LS", "sedan"], ["ux", "UX", "crossover"], ["nx", "NX", "suv"], ["rx", "RX", "suv"], ["lx", "LX", "suv"], ["gx", "GX", "suv"]]) },
  { slug: "land-rover", nameEn: "Land Rover", nameAr: "لاند روفر", models: m([
    ["range-rover", "Range Rover", "suv", "رينج روفر"], ["range-rover-sport", "Range Rover Sport", "suv", "رينج روفر سبورت"], ["range-rover-velar", "Range Rover Velar", "suv", "رينج روفر فيلار"],
    ["range-rover-evoque", "Range Rover Evoque", "suv", "رينج روفر إيفوك"], ["discovery", "Discovery", "suv", "ديسكفري"], ["discovery-sport", "Discovery Sport", "suv", "ديسكفري سبورت"], ["defender", "Defender", "suv", "ديفندر"],
  ]) },
  { slug: "porsche", nameEn: "Porsche", nameAr: "بورش", models: m([["911", "911", "coupe"], ["cayenne", "Cayenne", "suv", "كايين"], ["cayenne-coupe", "Cayenne Coupe", "suv"], ["macan", "Macan", "suv", "ماكان"], ["panamera", "Panamera", "sedan", "باناميرا"], ["taycan", "Taycan", "sedan", "تايكان"], ["718", "718 Cayman / Boxster", "coupe"]]) },
  { slug: "volvo", nameEn: "Volvo", nameAr: "فولفو", models: m([["s60", "S60", "sedan"], ["s90", "S90", "sedan"], ["xc40", "XC40", "crossover"], ["xc60", "XC60", "suv"], ["xc90", "XC90", "suv"], ["ex30", "EX30", "crossover"], ["c40", "C40", "crossover"]]) },
  { slug: "mini", nameEn: "Mini", nameAr: "ميني", models: m([["cooper", "Cooper", "hatchback", "كوبر"], ["cooper-s", "Cooper S", "hatchback"], ["countryman", "Countryman", "crossover", "كانتري مان"], ["clubman", "Clubman", "wagon"], ["convertible", "Convertible", "convertible"]]) },
  { slug: "jaguar", nameEn: "Jaguar", nameAr: "جاكوار", models: m([["xe", "XE", "sedan"], ["xf", "XF", "sedan"], ["xj", "XJ", "sedan"], ["e-pace", "E-Pace", "crossover"], ["f-pace", "F-Pace", "suv"], ["i-pace", "I-Pace", "suv"]]) },
  { slug: "infiniti", nameEn: "Infiniti", nameAr: "إنفينيتي", models: m([["q50", "Q50", "sedan"], ["qx50", "QX50", "suv"], ["qx55", "QX55", "suv"], ["qx60", "QX60", "suv"], ["qx80", "QX80", "suv"]]) },
  { slug: "tesla", nameEn: "Tesla", nameAr: "تسلا", models: m([["model-3", "Model 3", "sedan"], ["model-y", "Model Y", "crossover"], ["model-s", "Model S", "sedan"], ["model-x", "Model X", "suv"]]) },
  { slug: "haval", nameEn: "Haval", nameAr: "هافال", models: m([["h6", "H6", "suv"], ["jolion", "Jolion", "crossover", "جوليون"], ["h9", "H9", "suv"], ["dargo", "Dargo", "suv", "دارجو"], ["h2", "H2", "crossover"]]) },
  { slug: "great-wall", nameEn: "Great Wall", nameAr: "جريت وول", models: m([["wingle", "Wingle", "pickup", "وينجل"], ["poer", "Poer", "pickup", "باور"], ["c30", "C30", "sedan"]]) },
  { slug: "jetour", nameEn: "Jetour", nameAr: "جيتور", models: m([["x70", "X70", "suv"], ["x70-plus", "X70 Plus", "suv"], ["x90", "X90", "suv"], ["dashing", "Dashing", "suv", "داشينج"], ["t2", "T2", "suv"]]) },
  { slug: "changan", nameEn: "Changan", nameAr: "شانجان", models: m([["alsvin", "Alsvin", "sedan", "ألسفين"], ["eado", "Eado", "sedan", "إيدو"], ["cs15", "CS15", "crossover"], ["cs35-plus", "CS35 Plus", "crossover"], ["cs55-plus", "CS55 Plus", "suv"], ["cs75", "CS75", "suv"], ["uni-k", "UNI-K", "suv"], ["uni-t", "UNI-T", "crossover"]]) },
  { slug: "baic", nameEn: "BAIC", nameAr: "بايك", models: m([["x3", "X3", "crossover"], ["x35", "X35", "crossover"], ["x7", "X7", "suv"], ["beijing-x7", "Beijing X7", "suv"], ["u5-plus", "U5 Plus", "sedan"], ["bj40", "BJ40", "suv"]]) },
  { slug: "proton", nameEn: "Proton", nameAr: "بروتون", models: m([["saga", "Saga", "sedan", "ساجا"], ["persona", "Persona", "sedan", "بيرسونا"], ["gen-2", "Gen-2", "hatchback"], ["preve", "Preve", "sedan"], ["x50", "X50", "crossover"], ["x70", "X70", "suv"]]) },
  { slug: "speranza", nameEn: "Speranza", nameAr: "سبرانزا", models: m([["a113", "A113", "hatchback"], ["a213", "A213", "sedan"], ["a516", "A516", "sedan"], ["a620", "A620", "sedan"], ["tiggo", "Tiggo", "suv"], ["envy", "Envy", "hatchback"]]) },
  { slug: "dongfeng", nameEn: "Dongfeng", nameAr: "دونج فينج", models: m([["aeolus-a30", "Aeolus A30", "sedan"], ["aeolus-shine", "Aeolus Shine", "sedan"], ["ax7", "AX7", "suv"], ["glory-580", "Glory 580", "suv"], ["mage", "Mage", "crossover"]]) },
  { slug: "dfsk", nameEn: "DFSK", nameAr: "دي إف إس كيه", models: m([["glory-500", "Glory 500", "suv"], ["glory-580", "Glory 580", "suv"], ["mini-truck", "Mini Truck", "pickup"], ["mini-van", "Mini Van", "van"]]) },
  { slug: "exeed", nameEn: "Exeed", nameAr: "إكسيد", models: m([["lx", "LX", "crossover"], ["txl", "TXL", "suv"], ["vx", "VX", "suv"], ["rx", "RX", "suv"]]) },
  { slug: "gac", nameEn: "GAC", nameAr: "جي إيه سي", models: m([["gs3", "GS3", "crossover"], ["gs4", "GS4", "suv"], ["gs8", "GS8", "suv"], ["ga4", "GA4", "sedan"], ["ga6", "GA6", "sedan"], ["emkoo", "Emkoo", "suv"], ["empow", "Empow", "sedan"]]) },
  { slug: "hongqi", nameEn: "Hongqi", nameAr: "هونشي", models: m([["h5", "H5", "sedan"], ["h9", "H9", "sedan"], ["hs3", "HS3", "suv"], ["hs5", "HS5", "suv"], ["e-hs9", "E-HS9", "suv"]]) },
  { slug: "jac", nameEn: "JAC", nameAr: "جاك", models: m([["j7", "J7", "sedan"], ["s2", "S2", "crossover"], ["s3", "S3", "crossover"], ["s4", "S4", "suv"], ["js4", "JS4", "suv"], ["t8", "T8", "pickup"]]) },
  { slug: "kaiyi", nameEn: "Kaiyi", nameAr: "كايي", models: m([["x3", "X3", "crossover"], ["x3-pro", "X3 Pro", "crossover"], ["e5", "E5", "sedan"]]) },
  { slug: "bestune", nameEn: "Bestune", nameAr: "بستيون", models: m([["t33", "T33", "crossover"], ["t55", "T55", "suv"], ["t77", "T77", "suv"], ["b70", "B70", "sedan"]]) },
  { slug: "lada", nameEn: "Lada", nameAr: "لادا", models: m([["granta", "Granta", "sedan", "جرانتا"], ["vesta", "Vesta", "sedan", "فيستا"], ["niva", "Niva", "suv", "نيفا"], ["2107", "2107", "sedan"]]) },
  { slug: "daewoo", nameEn: "Daewoo", nameAr: "دايو", models: m([["lanos", "Lanos", "sedan", "لانوس"], ["nubira", "Nubira", "sedan", "نوبيرا"], ["matiz", "Matiz", "hatchback", "ماتيز"], ["cielo", "Cielo", "sedan", "سيلو"]]) },
  { slug: "isuzu", nameEn: "Isuzu", nameAr: "إيسوزو", models: m([["d-max", "D-Max", "pickup", "دي ماكس"], ["mu-x", "MU-X", "suv"]]) },
  { slug: "zeekr", nameEn: "Zeekr", nameAr: "زيكر", models: m([["001", "001", "wagon"], ["007", "007", "sedan"], ["x", "X", "crossover"], ["7x", "7X", "suv"]]) },
  { slug: "lynk-co", nameEn: "Lynk & Co", nameAr: "لينك آند كو", models: m([["01", "01", "suv"], ["03", "03", "sedan"], ["05", "05", "suv"], ["06", "06", "crossover"]]) },
  { slug: "avatr", nameEn: "Avatr", nameAr: "أفاتر", models: m([["11", "11", "suv"], ["12", "12", "sedan"]]) },
  { slug: "seres", nameEn: "Seres", nameAr: "سيريس", models: m([["3", "3", "crossover"], ["5", "5", "suv"]]) },
  { slug: "alfa-romeo", nameEn: "Alfa Romeo", nameAr: "ألفا روميو", models: m([["giulia", "Giulia", "sedan", "جوليا"], ["giulietta", "Giulietta", "hatchback", "جولييتا"], ["stelvio", "Stelvio", "suv", "ستلفيو"], ["tonale", "Tonale", "crossover", "تونالي"]]) },
  { slug: "dodge", nameEn: "Dodge", nameAr: "دودج", models: m([["charger", "Charger", "sedan", "تشارجر"], ["challenger", "Challenger", "coupe", "تشالنجر"], ["durango", "Durango", "suv", "دورانجو"], ["ram", "Ram", "pickup", "رام"]]) },
  { slug: "cadillac", nameEn: "Cadillac", nameAr: "كاديلاك", models: m([["escalade", "Escalade", "suv", "إسكاليد"], ["ct4", "CT4", "sedan"], ["ct5", "CT5", "sedan"], ["xt4", "XT4", "crossover"], ["xt5", "XT5", "suv"], ["xt6", "XT6", "suv"]]) },
  { slug: "maserati", nameEn: "Maserati", nameAr: "مازيراتي", models: m([["ghibli", "Ghibli", "sedan"], ["quattroporte", "Quattroporte", "sedan"], ["levante", "Levante", "suv"], ["grecale", "Grecale", "suv"]]) },
  { slug: "genesis", nameEn: "Genesis", nameAr: "جينيسيس", models: m([["g70", "G70", "sedan"], ["g80", "G80", "sedan"], ["g90", "G90", "sedan"], ["gv70", "GV70", "suv"], ["gv80", "GV80", "suv"]]) },
  { slug: "brilliance", nameEn: "Brilliance", nameAr: "بريليانس", models: m([["v5", "V5", "suv"], ["fsv", "FSV", "sedan"], ["frv", "FRV", "hatchback"], ["galena", "Galena", "sedan", "جالينا"], ["splendor", "Splendor", "sedan"], ["h320", "H320", "hatchback"], ["h330", "H330", "sedan"], ["v6", "V6", "suv"]]) },
  { slug: "senova", nameEn: "Senova", nameAr: "سينوفا", models: m([["d20", "D20", "sedan"], ["x25", "X25", "crossover"], ["x35", "X35", "crossover"], ["x55", "X55", "suv"]]) },
  { slug: "soueast", nameEn: "Soueast", nameAr: "ساوايست", models: m([["s06", "S06", "crossover"], ["s07", "S07", "suv"], ["s09", "S09", "suv"], ["dx3", "DX3", "crossover"], ["dx7", "DX7", "suv"]]) },
  { slug: "foton", nameEn: "Foton", nameAr: "فوتون", models: m([["tunland", "Tunland", "pickup", "تونلاند"], ["view", "View", "van"], ["sauvana", "Sauvana", "suv"]]) },
  { slug: "forthing", nameEn: "Forthing", nameAr: "فورثينج", models: m([["t5-evo", "T5 EVO", "suv"], ["friday", "Friday", "crossover"], ["u-tour", "U-Tour", "van"]]) },
  { slug: "rox", nameEn: "Rox", nameAr: "روكس", models: m([["01", "01", "suv"]]) },
  { slug: "deepal", nameEn: "Deepal", nameAr: "ديبال", models: m([["s07", "S07", "suv"], ["l07", "L07", "sedan"], ["g318", "G318", "suv"]]) },
  { slug: "leapmotor", nameEn: "Leapmotor", nameAr: "ليب موتور", models: m([["t03", "T03", "hatchback"], ["c10", "C10", "suv"], ["c11", "C11", "suv"], ["b10", "B10", "crossover"]]) },
  { slug: "xpeng", nameEn: "Xpeng", nameAr: "إكسبنج", models: m([["g6", "G6", "suv"], ["g9", "G9", "suv"], ["p7", "P7", "sedan"]]) },
  { slug: "neta", nameEn: "Neta", nameAr: "نيتا", models: m([["v", "V", "crossover"], ["u", "U", "suv"], ["s", "S", "sedan"], ["x", "X", "suv"]]) },
  { slug: "voyah", nameEn: "Voyah", nameAr: "فوياه", models: m([["free", "Free", "suv"], ["dreamer", "Dreamer", "van"], ["courage", "Courage", "suv"]]) },
  { slug: "polestar", nameEn: "Polestar", nameAr: "بولستار", models: m([["2", "Polestar 2", "sedan"], ["3", "Polestar 3", "suv"], ["4", "Polestar 4", "suv"]]) },
  { slug: "smart", nameEn: "Smart", nameAr: "سمارت", models: m([["fortwo", "ForTwo", "hatchback"], ["forfour", "ForFour", "hatchback"], ["1", "#1", "crossover"], ["3", "#3", "crossover"]]) },
  { slug: "daihatsu", nameEn: "Daihatsu", nameAr: "دايهاتسو", models: m([["terios", "Terios", "suv", "تيريوس"], ["gran-max", "Gran Max", "van", "جران ماكس"], ["sirion", "Sirion", "hatchback", "سيريون"], ["charade", "Charade", "hatchback"]]) },
  { slug: "tata", nameEn: "Tata", nameAr: "تاتا", models: m([["indica", "Indica", "hatchback", "إنديكا"], ["indigo", "Indigo", "sedan", "إنديجو"], ["xenon", "Xenon", "pickup"]]) },
  { slug: "chrysler", nameEn: "Chrysler", nameAr: "كرايسلر", models: m([["300c", "300C", "sedan"], ["pacifica", "Pacifica", "van"]]) },
  { slug: "gmc", nameEn: "GMC", nameAr: "جي إم سي", models: m([["yukon", "Yukon", "suv", "يوكن"], ["sierra", "Sierra", "pickup"], ["terrain", "Terrain", "suv"], ["acadia", "Acadia", "suv"]]) },
  { slug: "lincoln", nameEn: "Lincoln", nameAr: "لينكولن", models: m([["navigator", "Navigator", "suv"], ["aviator", "Aviator", "suv"], ["corsair", "Corsair", "suv"]]) },
  { slug: "bentley", nameEn: "Bentley", nameAr: "بنتلي", models: m([["bentayga", "Bentayga", "suv"], ["continental-gt", "Continental GT", "coupe"], ["flying-spur", "Flying Spur", "sedan"]]) },
  { slug: "rolls-royce", nameEn: "Rolls-Royce", nameAr: "رولز رويس", models: m([["cullinan", "Cullinan", "suv"], ["ghost", "Ghost", "sedan"], ["phantom", "Phantom", "sedan"], ["wraith", "Wraith", "coupe"], ["spectre", "Spectre", "coupe"]]) },
  { slug: "ferrari", nameEn: "Ferrari", nameAr: "فيراري", models: m([["roma", "Roma", "coupe"], ["portofino", "Portofino", "convertible"], ["296", "296", "coupe"], ["f8", "F8", "coupe"], ["sf90", "SF90", "coupe"], ["purosangue", "Purosangue", "suv"]]) },
  { slug: "lamborghini", nameEn: "Lamborghini", nameAr: "لامبورجيني", models: m([["urus", "Urus", "suv"], ["huracan", "Huracán", "coupe"], ["revuelto", "Revuelto", "coupe"]]) },
  { slug: "aston-martin", nameEn: "Aston Martin", nameAr: "أستون مارتن", models: m([["dbx", "DBX", "suv"], ["db12", "DB12", "coupe"], ["vantage", "Vantage", "coupe"]]) },
  { slug: "mclaren", nameEn: "McLaren", nameAr: "ماكلارين", models: m([["gt", "GT", "coupe"], ["artura", "Artura", "coupe"], ["720s", "720S", "coupe"]]) },
];
