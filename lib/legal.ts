import { APP_NAME, LEGAL_UPDATED, OPERATOR_NAME, SUPPORT_EMAIL } from "./config";

// The Terms of Service and Privacy Policy shown in the app (and mirrored in docs/legal for
// the public URLs the app stores ask for). They describe what the app actually does: if a
// feature changes how data is used, change these with it.
//
// These are a careful starting point, not legal advice: have a South African attorney review
// them before launch. See docs/RELEASE.md.

export interface LegalSection {
  heading: string;
  // Paragraphs; a string starting with "• " renders as a bullet.
  body: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const TERMS: LegalDocument = {
  title: "Terms of Service",
  updated: LEGAL_UPDATED,
  intro: `These terms are an agreement between you and ${OPERATOR_NAME} ("${APP_NAME}", "we", "us"). By creating an account or using the app you agree to them. If you don't agree, please don't use ${APP_NAME}.`,
  sections: [
    {
      heading: "1. What Siza is",
      body: [
        `${APP_NAME} is a marketplace that connects people who need a task done ("clients") with people willing to do it ("taskers"). Clients post tasks, taskers bid, and the client chooses whom to hire.`,
        `We provide the platform only. We are not a party to the agreement between a client and a tasker, we don't employ taskers, and we don't supervise, direct or guarantee their work. Taskers are independent and decide which tasks to bid on, at what price, and how to do the work.`,
      ],
    },
    {
      heading: "2. Who can use it",
      body: [
        "You must be at least 18 years old and able to enter into a binding agreement.",
        "Give accurate information when you sign up and keep it up to date. You're responsible for what happens under your account, so keep your password private and tell us straight away if you think someone else has used it.",
        "One person, one account. Don't create an account for someone else or after we've closed yours.",
      ],
    },
    {
      heading: "3. Posting and doing tasks",
      body: [
        "Clients: describe the task honestly and completely, including anything that affects safety or price. Only post tasks that are legal and that you have the right to ask for.",
        "Taskers: only bid on work you're able and, where the law requires it, qualified or licensed to do. You're responsible for your own tools, transport, taxes and insurance.",
        "A task's street address is shared only with the tasker the client hires. Everyone else sees the suburb and an approximate location.",
        "When a client accepts a bid, the client and the tasker have agreed that the tasker will do the task as described for the bid amount. Changes are between the two of you; agree them in the chat before the work is done.",
      ],
    },
    {
      heading: "4. Payments",
      body: [
        "All prices are in South African Rand. The client pays the accepted bid amount through the app once the work is done. Payments are processed by Paystack; we never see or store your card details.",
        "Paying for a task marks it as completed. Check the work before you pay.",
        "Keep payments in the app. Paying or asking to be paid another way removes the record of the payment and is a common sign of a scam; please report it.",
        `If we introduce a service fee, it will be shown clearly before you commit to a task or a payment.`,
        "Either side can cancel a job before it's paid for. Refunds after payment are a matter between the client and the tasker; contact us if you can't resolve it and we'll help where we reasonably can.",
      ],
    },
    {
      heading: "5. How to behave",
      body: [
        "You agree not to:",
        "• post anything false, misleading, unlawful, hateful, threatening, sexually explicit or that infringes someone else's rights;",
        "• harass, abuse or discriminate against anyone;",
        "• use the app for anything illegal, or to offer or request unsafe work;",
        "• collect other users' information, or contact them for anything other than the task;",
        "• interfere with the app, try to access data that isn't yours, or get around its security;",
        "• manipulate reviews, or create fake tasks, bids or accounts.",
        "You can report a person or a task and block anyone from the app. We review reports and may remove content, or suspend or close accounts that break these terms.",
      ],
    },
    {
      heading: "6. Reviews and your content",
      body: [
        "After a completed task, each side can rate and review the other. Reviews must be honest and about the task.",
        `You keep ownership of what you post (tasks, photos, messages, reviews). You give us permission to store, display and share it within ${APP_NAME} as needed to run the service.`,
      ],
    },
    {
      heading: "7. Safety",
      body: [
        "Meeting someone you found online carries risk. Use your judgement: read a person's reviews, keep communication in the app, and stop if something feels wrong.",
        "We don't run background, identity or criminal-record checks on users unless we say so explicitly in the app.",
        "In an emergency, contact the police (10111) or emergency services (112 from a mobile phone).",
      ],
    },
    {
      heading: "8. Our responsibility to you",
      body: [
        `We work to keep ${APP_NAME} available and secure, but it's provided "as is" and we can't promise it will always be available or error-free.`,
        "To the extent the law allows, we aren't liable for the acts or omissions of other users, the quality, safety or legality of any task or work, or any indirect or consequential loss. Nothing in these terms limits any right you have under the Consumer Protection Act 68 of 2008 or other law that can't be excluded by agreement.",
      ],
    },
    {
      heading: "9. Ending your account",
      body: [
        "You can delete your account at any time from Profile > Delete account. Finish or cancel any job in progress first.",
        "We may suspend or close an account that breaks these terms or puts other people at risk.",
      ],
    },
    {
      heading: "10. Changes and governing law",
      body: [
        "We may update these terms. If a change is significant we'll tell you in the app before it takes effect. Continuing to use the app after that means you accept the updated terms.",
        "These terms are governed by the laws of the Republic of South Africa.",
      ],
    },
    {
      heading: "11. Contact",
      body: [`Questions about these terms: ${SUPPORT_EMAIL}`],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  updated: LEGAL_UPDATED,
  intro: `This policy explains what personal information ${OPERATOR_NAME} ("${APP_NAME}", "we") collects when you use the app, why, and what you can do about it. We process personal information in line with the Protection of Personal Information Act 4 of 2013 (POPIA).`,
  sections: [
    {
      heading: "1. What we collect",
      body: [
        "• Account: your name, email address and password (stored only in hashed form).",
        "• Profile: your photo, bio, whether you post tasks, do tasks or both, and the ratings and reviews you receive.",
        "• Tasks: what you post, including the description, photo, budget, timing, suburb, street address and map position.",
        "• Bids, messages and reviews you send in the app.",
        "• Location: your device's position while the app is open, when you allow it, to show tasks near you and to set a task's location. We don't track your location in the background.",
        "• Payments: the amount, status and reference of each payment. Card and bank details are entered on Paystack's checkout and never reach us.",
        "• Reports and blocks you make, and reports made about you.",
      ],
    },
    {
      heading: "2. Why we use it",
      body: [
        "• To provide the service: showing tasks, passing on bids and messages, processing payments, and sending in-app notifications.",
        "• To keep people safe: reviewing reports, preventing fraud and enforcing our terms.",
        "• To meet legal obligations, such as keeping financial records.",
        "We rely on our agreement with you, our legitimate interest in running a safe marketplace, legal obligations, and your consent (for location and photos, which you can withdraw in your device settings).",
        "We don't sell your personal information and we don't use it for advertising.",
      ],
    },
    {
      heading: "3. What other users can see",
      body: [
        "• Anyone signed in can see your name, photo, bio, rating and reviews.",
        "• Anyone signed in can see a task's title, description, photo, budget, timing, suburb and approximate map position (accurate to about 500 metres).",
        "• A task's street address and exact position are shown only to you and to the tasker you hire.",
        "• Bids are visible only to the tasker who made them and the client who posted the task.",
        "• Messages are visible only to the two people in the conversation.",
        "• Nobody can see who you've blocked or reported.",
      ],
    },
    {
      heading: "4. Who we share it with",
      body: [
        "• Supabase, which hosts our database, sign-in system and file storage.",
        "• Paystack, which processes payments.",
        "• Authorities, when the law requires it or to protect someone's safety.",
        "Some of these providers store or process information outside South Africa. Where that happens we rely on agreements that require protection comparable to POPIA.",
      ],
    },
    {
      heading: "5. How long we keep it",
      body: [
        "We keep your information while your account is open. When you delete your account we delete your profile, photos, tasks, bids, messages, notifications and the reviews you wrote.",
        "Records of payments are kept by Paystack, and by us where the law requires, for as long as the law requires. Reports about safety may be kept after an account is deleted, without the deleted person's identity.",
      ],
    },
    {
      heading: "6. Your rights",
      body: [
        "You can:",
        "• see and correct your profile in the app at any time;",
        "• delete your account and its data from Profile > Delete account;",
        "• ask us for a copy of your personal information, or ask us to correct or delete it;",
        "• object to how we use your information, or withdraw a consent you've given.",
        `Email ${SUPPORT_EMAIL} and we'll respond within a reasonable time. If you're not satisfied, you can complain to the Information Regulator (South Africa) at inforeg.org.za.`,
      ],
    },
    {
      heading: "7. Security",
      body: [
        "Information is encrypted in transit, access to it is restricted by per-user rules in our database, and your sign-in session is kept in your device's secure storage. No system is perfectly secure; if a breach affects you we'll tell you and the Information Regulator as the law requires.",
      ],
    },
    {
      heading: "8. Children",
      body: [`${APP_NAME} is for adults. We don't knowingly collect information from anyone under 18.`],
    },
    {
      heading: "9. Changes",
      body: ["If we change this policy in a way that matters, we'll tell you in the app before the change takes effect."],
    },
    {
      heading: "10. Contact",
      body: [`Our Information Officer can be reached at ${SUPPORT_EMAIL}.`],
    },
  ],
};
