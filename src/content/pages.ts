import type { Locale } from "@/i18n/config";

export type PageSection = { heading?: string; paragraphs?: string[]; list?: string[] };
export type StaticPage = { title: string; intro?: string; draft?: boolean; sections: PageSection[] };
export type PageKey = "about" | "verification" | "faq" | "terms" | "privacy" | "contact";

const ar: Record<PageKey, StaticPage> = {
  about: {
    title: "عن موتورنا",
    intro: "موتورنا سوق للسيارات الجديدة والمستعملة في مصر، بادئ من الإسكندرية.",
    sections: [
      { paragraphs: ["بنحاول نخلّي بيع وشراء العربيات أوضح وأأمن: كل إعلان بيتراجع قبل النشر، والتواصل بيتم من جوه المنصة، وبنقول بصراحة إيه اللي اتراجع وإيه اللي لأ."] },
      { heading: "اللي بنعمله", list: ["مراجعة الإعلانات والصور قبل النشر", "فلاتر دقيقة بالسعر والموديل والسنة والمحافظة", "رسائل بين المشتري والبائع من غير ما الرقم يظهر إلا بموافقة البائع", "استقبال البلاغات ومراجعتها"] },
      { heading: "اللي مش بنعمله", list: ["مش بنمتلك العربيات المعروضة", "مش بنستلم أي فلوس أو عربون بين البائع والمشتري", "مش بنضمن حالة العربية أو أوراقها — المعاينة والفحص مسؤولية المشتري"] },
    ],
  },
  verification: {
    title: "إزاي بنراجع الإعلانات",
    intro: "الثقة بتيجي من الوضوح. ده اللي بنعمله فعلًا النهارده، واللي لسه جاي.",
    sections: [
      { heading: "اللي بنراجعه دلوقتي", list: ["إن الصور حقيقية وللعربية نفسها ومش منقولة من النت", "إن الماركة والموديل والسنة متطابقين مع الصور", "إن السعر منطقي ومش طُعم لجذب الناس", "إن الوصف مفيهوش أرقام تحويل أو طلب عربون"] },
      { heading: "اللي مش بنراجعه لسه", paragraphs: ["لحد دلوقتي ما بنتحققش من هوية البائع، ولا من ملكية العربية، ولا من العداد، ولا من تاريخ الحوادث، ولا من المخالفات. أي شارة توثيق هتظهر في المستقبل هتكون مربوطة بفحص فعلي، وهنوضّح بالظبط اتفحص إيه وإمتى."] },
      { heading: "لو شفت حاجة غلط", paragraphs: ["استخدم زرار «بلّغ عن الإعلان» في صفحة العربية. البلاغ بيوصل للمشرفين، ويقدروا يشيلوا الإعلان أو يوقفوا الحساب."] },
      { heading: "قريبًا", list: ["توثيق هوية البائعين والمعارض", "حجز فحص فني من مراكز شريكة مع تقرير مفصّل", "تقدير السعر العادل مع توضيح مستوى الثقة في التقدير"] },
    ],
  },
  faq: {
    title: "الأسئلة الشائعة",
    sections: [
      { heading: "الإعلان مجاني؟", paragraphs: ["أيوه، الإعلان الأساسي مجاني للأفراد."] },
      { heading: "إعلاني بيتنشر إمتى؟", paragraphs: ["بعد ما مشرف يراجعه ويوافق عليه. تقدر تتابع الحالة من «إعلاناتي»، ولو اترفض هتشوف السبب وتقدر تعدّله وتبعته تاني."] },
      { heading: "ليه رقمي مش ظاهر؟", paragraphs: ["الرقم بيظهر للمستخدمين المسجلين بس، ولو انت فعّلت ده من الملف الشخصي. غير كده التواصل بيكون بالرسائل."] },
      { heading: "البائع طلب عربون قبل المعاينة، أعمل إيه؟", paragraphs: ["ماتحولش أي فلوس. بلّغ عن الإعلان فورًا. موتورنا مابيطلبش ولا بيستلم أي مدفوعات."] },
      { heading: "أقدر أحجز صيانة أو فحص من خلال موتورنا؟", paragraphs: ["في المراكز اللي موتورنا فعّلت عندها الحجز أونلاين بس، وهتلاقي زرار «احجز ميعاد» في صفحة المركز. غير كده كلّم المركز مباشرة. الحجز بيتأكد لما المركز يقبل الميعاد، والدفع بيبقى للمركز مباشرة."] },
      { heading: "أعدّل السعر من غير ما الإعلان يرجع للمراجعة؟", paragraphs: ["أيوه. تعديل السعر بس بيفضّل الإعلان منشور. تعديل باقي البيانات أو صورة الغلاف بيرجّعه للمراجعة."] },
    ],
  },
  terms: {
    title: "الشروط والأحكام",
    draft: true,
    sections: [
      { heading: "طبيعة الخدمة", paragraphs: ["موتورنا منصة إعلانات تربط البائعين بالمشترين. المنصة ليست طرفًا في أي عملية بيع، ولا تضمن حالة السيارات أو صحة المستندات."] },
      { heading: "التزامات المعلن", list: ["أن تكون مالكًا للسيارة أو مفوضًا بالبيع", "أن تكون البيانات والصور صحيحة وحديثة", "عدم نشر إعلانات مكررة أو مضللة", "عدم طلب مبالغ مالية قبل المعاينة"] },
      { heading: "المراجعة والإيقاف", paragraphs: ["يحق لموتورنا رفض أو إيقاف أي إعلان أو حساب يخالف هذه الشروط أو يثير شبهة احتيال."] },
      { heading: "موتورنا كير والحجوزات", list: ["المراكز المدرجة جهات مستقلة. موتورنا مش بتقدّم الخدمة ومش طرف في الاتفاق بينك وبين المركز.", "الحجز مش مؤكد غير لما المركز يقبل ميعاد. الميعاد المطلوب أو المقترح مش تأكيد.", "الأسعار التقديرية مش عرض سعر نهائي، والسعر النهائي بيتفق عليه مع المركز.", "الدفع للمركز مباشرة. موتورنا مش بتحصّل فلوس الخدمة ولا رسوم حجز.", "الإلغاء بعد مهلة الإلغاء المجاني بيتسجل «إلغاء متأخر» من غير أي رسوم من موتورنا.", "بنراجع الشكاوى ونسجل قرار، لكن مش بنضمن استرداد فلوس أو نتيجة أي خدمة."] },
      { heading: "التزامات المراكز", list: ["تقديم بيانات ومستندات صحيحة وسارية", "الالتزام بالمواعيد المؤكدة أو الإلغاء مع ذكر السبب", "تسجيل إتمام الخدمة والمبلغ بأمانة", "سداد العمولة المتفق عليها في اتفاقية منفصلة مع موتورنا"] },
      { heading: "حدود المسؤولية", paragraphs: ["المشتري مسؤول عن معاينة السيارة وفحصها والتحقق من أوراقها قبل الشراء."] },
    ],
  },
  privacy: {
    title: "سياسة الخصوصية",
    draft: true,
    sections: [
      { heading: "البيانات اللي بنجمعها", list: ["الاسم والبريد الإلكتروني وكلمة المرور (مشفرة)", "رقم الموبايل والمحافظة لو أضفتهم", "بيانات الإعلانات والصور (بنمسح بيانات الموقع من الصور تلقائيًا)", "الرسائل بين المستخدمين", "بيانات تقنية أساسية للأمان زي عنوان IP"] },
      { heading: "بنستخدمها في إيه", list: ["تشغيل الحساب والإعلانات والرسائل", "منع الاحتيال والإساءة ومراجعة البلاغات", "التواصل معاك بخصوص حسابك"] },
      { heading: "المشاركة", paragraphs: ["مش بنبيع بياناتك. رقم موبايلك مش بيظهر غير لو انت فعّلت إظهاره."] },
      { heading: "موتورنا كير والحجوزات", list: ["طلبات المراكز: بيانات النشاط والمستندات الرسمية. المستندات محفوظة في مساحة خاصة ومش بيشوفها غير فريق المراجعة. أسماء الفنيين مش بتظهر للعامة.", "لما تحجز: اسمك ورقم موبايلك وبيانات العربية وملاحظاتك بتتبعت للمركز اللي حجزت عنده بس، عشان يجهّز للميعاد ويتواصل معاك.", "بنحتفظ بسجل الحجز وحالاته، واللي المركز بيسجله بعد الخدمة (اللي اتعمل والمبلغ) كسجل صيانة لعربيتك ولحساب العمولة مع المركز.", "عربياتك المحفوظة بتظهر لك إنت بس."] },
      { heading: "الإشعارات", paragraphs: ["بنبعت إشعارات جوه الموقع عن إعلاناتك ورسايلك وحجوزاتك. الإيميل بيتبعت بس لما يكون مفعّل."] },
      { heading: "حقوقك", paragraphs: ["تقدر تعدّل بياناتك أو تحذف إعلاناتك في أي وقت. لحذف الحساب بالكامل تواصل معانا."] },
    ],
  },
  contact: {
    title: "تواصل معنا",
    sections: [{ paragraphs: ["للبلاغات العاجلة عن إعلان معيّن، استخدم زرار البلاغ في صفحة الإعلان — ده أسرع طريق للمراجعة."] }],
  },
};

const en: Record<PageKey, StaticPage> = {
  about: {
    title: "About MOTORNA",
    intro: "MOTORNA is a marketplace for new and used cars in Egypt, starting in Alexandria.",
    sections: [
      { paragraphs: ["We want buying and selling a car to be clearer and safer: every listing is reviewed before it goes live, conversations happen on the platform, and we say plainly what has and hasn't been checked."] },
      { heading: "What we do", list: ["Review listings and photos before publishing", "Precise filters by price, model, year and governorate", "Buyer–seller messaging without exposing phone numbers unless the seller opts in", "Take and review reports"] },
      { heading: "What we don't do", list: ["We don't own the cars listed", "We never hold money or deposits between buyers and sellers", "We don't guarantee a car's condition or papers — inspection is the buyer's responsibility"] },
    ],
  },
  verification: {
    title: "How we review listings",
    intro: "Trust comes from being specific. Here is what we actually do today, and what's coming.",
    sections: [
      { heading: "What we check now", list: ["Photos are real, of this car, and not copied from the web", "Make, model and year match the photos", "The price is plausible and not bait", "The description has no transfer numbers or deposit requests"] },
      { heading: "What we don't check yet", paragraphs: ["We don't currently verify seller identity, ownership, mileage, accident history or traffic fines. Any verification badge we add later will be tied to an actual check, with exactly what was checked and when."] },
      { heading: "If something looks wrong", paragraphs: ["Use “Report listing” on the car's page. Reports go to MOTORNA moderators, who can remove the listing or suspend the account."] },
      { heading: "Coming next", list: ["Identity verification for sellers and dealers", "Inspection booking with partner centres and a detailed report", "Fair-price estimates that show how confident the estimate is"] },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    sections: [
      { heading: "Is listing free?", paragraphs: ["Yes, basic listings are free for individuals."] },
      { heading: "When will my listing go live?", paragraphs: ["Once a moderator has reviewed and approved it. Track its status in My listings; if it's rejected you'll see why and can edit and resubmit."] },
      { heading: "Why isn't my number shown?", paragraphs: ["Your number is only shown to signed-in users, and only if you enable it in your profile. Otherwise buyers message you."] },
      { heading: "A seller asked for a deposit before I saw the car. What do I do?", paragraphs: ["Don't send money. Report the listing right away. MOTORNA never asks for or holds payments."] },
      { heading: "Can I book a service or inspection through MOTORNA?", paragraphs: ["Only at centers where MOTORNA has enabled online booking; you'll see a \"Book an appointment\" button on their page. Otherwise, contact the center directly. A booking is confirmed when the center accepts the time, and you pay the center directly."] },
      { heading: "Can I change the price without re-review?", paragraphs: ["Yes. Changing only the price keeps the listing live. Changing other details or the cover photo sends it back to review."] },
    ],
  },
  terms: {
    title: "Terms of use",
    draft: true,
    sections: [
      { heading: "The service", paragraphs: ["MOTORNA is a listings platform connecting sellers and buyers. It is not a party to any sale and does not guarantee vehicle condition or documents."] },
      { heading: "Seller obligations", list: ["You own the car or are authorised to sell it", "Details and photos are accurate and current", "No duplicate or misleading listings", "No requests for money before inspection"] },
      { heading: "Review and suspension", paragraphs: ["MOTORNA may reject or remove any listing or account that breaks these terms or appears fraudulent."] },
      { heading: "MOTORNA Care and bookings", list: ["Listed providers are independent businesses. MOTORNA doesn't perform services and isn't a party to your agreement with a provider.", "A booking isn't confirmed until the provider accepts a time. A requested or proposed time is not a confirmation.", "Estimated prices are not final quotes; the final price is agreed with the provider.", "You pay the provider directly. MOTORNA doesn't collect service payments or charge booking fees.", "Cancelling after the free-cancellation deadline is recorded as a \"late cancellation\"; MOTORNA charges no fee.", "We review reported problems and record a decision, but we don't guarantee refunds or the outcome of any service."] },
      { heading: "Provider obligations", list: ["Provide accurate, current details and documents", "Honour confirmed appointments, or cancel with a reason", "Record completion and the amount truthfully", "Pay the commission agreed in a separate agreement with MOTORNA"] },
      { heading: "Limitation of liability", paragraphs: ["Buyers are responsible for inspecting the car and checking its papers before purchase."] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    draft: true,
    sections: [
      { heading: "What we collect", list: ["Name, email and password (hashed)", "Mobile number and governorate if you add them", "Listing details and photos (location metadata is stripped automatically)", "Messages between users", "Basic technical data for security, such as IP address"] },
      { heading: "How we use it", list: ["To run your account, listings and messages", "To prevent fraud and abuse and review reports", "To contact you about your account"] },
      { heading: "Sharing", paragraphs: ["We don't sell your data. Your mobile number is only shown if you enable it."] },
      { heading: "MOTORNA Care and bookings", list: ["Provider applications: business details and official documents. Documents are stored privately and seen only by the review team. Technicians' names aren't shown publicly.", "When you book: your name, mobile number, vehicle details and notes go only to the provider you book with, so they can prepare and contact you.", "We keep the booking history and status changes, and what the provider records after the service (work done and amount) as your vehicle's service record and to calculate commission with the provider.", "Your saved vehicles are visible only to you."] },
      { heading: "Notifications", paragraphs: ["We send in-app notifications about your listings, messages and bookings. Email is sent only when it's enabled."] },
      { heading: "Your rights", paragraphs: ["You can edit your details or delete your listings at any time. To delete your account entirely, contact us."] },
    ],
  },
  contact: {
    title: "Contact",
    sections: [{ paragraphs: ["For an urgent problem with a specific listing, use the report button on the listing page — it's the fastest route to review."] }],
  },
};

export function getStaticPage(locale: Locale, key: PageKey) {
  return (locale === "ar" ? ar : en)[key];
}
