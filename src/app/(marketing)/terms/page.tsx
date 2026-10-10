import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

const { operator: OPERATOR, contact: CONTACT } = LEGAL;
const EFFECTIVE = "October 10, 2026";
const NAME = BRAND.name;

export const metadata: Metadata = {
  title: { absolute: `Terms of service · ${NAME}` },
  description: `The terms for using ${NAME}.`,
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreeing to these terms",
    body: (
      <p>
        These terms are an agreement between you and {OPERATOR} (“we”, “us”), which operates {NAME}. By creating an account or using {NAME}, you agree to them and to our{" "}
        <a href="/privacy">Privacy Policy</a>. If you use {NAME} for a firm or other organization, you confirm you’re allowed to accept these terms for it. If you don’t agree, please don’t use{" "}
        {NAME}.
      </p>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: (
      <>
        <p>
          {NAME} helps financial professionals make and publish video: ideas, scripts, a teleprompter and recording, editing, captions, covers (including AI-generated cover scenes), post copy, and
          posting through our team or your own connected accounts.
        </p>
        <p>
          {NAME} is in early access. Features may change, be added or be removed, and the service may sometimes be unavailable. We’ll try to give notice of significant changes, but we don’t
          promise that any particular feature will continue to exist.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 and use {NAME} for your professional work.</li>
        <li>Give accurate information, keep your password private, and don’t share your account. You’re responsible for what happens under it.</li>
        <li>Tell us right away at <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if you think someone else has used your account.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You own what you put into {NAME} and what you make with it: your recordings, photos, scripts, captions, covers and finished videos (“your content”).
        </p>
        <p>
          You give us permission to host, copy, process, edit and transmit your content only as needed to run {NAME} for you: for example to edit your video, create covers and AI scenes from your
          photos, and post to the accounts you choose. This permission ends when you delete the content or your account, except for copies we must keep by law or that remain in backups for a limited
          time.
        </p>
        <p>
          You confirm you have the rights to everything you upload, including permission from anyone who appears in your videos or photos, and to any music, footage or images you add.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI-generated content",
    body: (
      <>
        <p>
          {NAME} uses artificial intelligence to suggest ideas and write scripts, captions and cover lines, and to create cover images, including new images of you based on your photo. AI output can be
          inaccurate, incomplete or unsuitable, and AI images may not look exactly like you or may show details that aren’t real.
        </p>
        <p>
          <strong>Review everything before you publish it.</strong> You decide what goes out, and you’re responsible for it. Don’t publish AI images or text that could mislead your audience.
        </p>
      </>
    ),
  },
  {
    id: "compliance",
    title: "Compliance is your responsibility",
    body: (
      <>
        <p>
          {NAME} is a production tool. It isn’t legal, compliance, tax or investment advice, and using it doesn’t make your content compliant. You and your firm remain responsible for meeting the rules
          that apply to you, including those of the SEC, FINRA, state regulators and your firm’s own policies, for example on communications with the public, testimonials, performance claims,
          supervision, approvals and recordkeeping.
        </p>
        <p>
          Features such as automatic disclosures, the reviewer approval step and the posting archive are there to help you, but they may not meet every requirement and they don’t replace your own
          review, your firm’s supervision or your recordkeeping obligations.
        </p>
      </>
    ),
  },
  {
    id: "posting",
    title: "Posting and other services",
    body: (
      <>
        <p>
          {NAME} works with third-party services such as Buffer and social networks (for example LinkedIn, YouTube, Instagram, Facebook, TikTok and X). When you connect or post to them, their own terms
          and policies apply too, and you’re responsible for following them.
        </p>
        <p>
          We aren’t responsible for those services, including posts they reject, delay, remove or publish differently, accounts they restrict, or changes to their features. When you ask our team to post
          for you, we’ll do so in good faith based on what you send, and you remain responsible for the content.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>Don’t use {NAME} to:</p>
        <ul>
          <li>break any law or regulation, or publish anything false, misleading or deceptive;</li>
          <li>infringe anyone’s copyright, trademark, privacy or publicity rights, or impersonate anyone;</li>
          <li>upload clients’ personal or account information, or other sensitive personal information;</li>
          <li>send spam, or harass, threaten or harm anyone;</li>
          <li>interfere with or try to get around {NAME}’s security, probe or overload it, or access other users’ accounts or content;</li>
          <li>copy, resell or reverse-engineer {NAME}, or use automated tools to scrape it.</li>
        </ul>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees",
    body: (
      <p>
        {NAME} is free during early access. Pricing after early access hasn’t been set. We’ll tell you before any charges start, and you’ll never be charged unless you choose a paid plan. Third-party
        services you connect, such as Buffer, may charge you separately under their own terms.
      </p>
    ),
  },
  {
    id: "illustrations",
    title: "Examples and sample numbers",
    body: (
      <p>
        Figures on our website and in the app, such as the ROI calculator, sample engagement numbers in the phone preview and example analytics, are illustrations only. They aren’t predictions or
        promises of results.
      </p>
    ),
  },
  {
    id: "ours",
    title: "Our property and your feedback",
    body: (
      <p>
        {NAME}, including its software, design, templates, styles and brand, belongs to {OPERATOR} and is protected by law. These terms don’t give you any rights to it beyond using the service. If you
        send us ideas or feedback, we may use them without any obligation to you.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Ending your use",
    body: (
      <p>
        You can stop using {NAME} at any time and ask us to delete your account. Download any videos you want to keep first. We may suspend or close an account that breaks these terms, puts others at
        risk or that we’re required to close by law, and we’ll tell you when we reasonably can. Sections that by their nature should continue (such as your content rights, disclaimers, limits on
        liability and indemnity) survive after your use ends.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        {NAME} is provided “as is” and “as available”. To the fullest extent the law allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose
        and non-infringement, and we don’t promise that {NAME} will be uninterrupted, error-free or secure, or that any content it produces will be accurate or bring you any particular result.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limits on our liability",
    body: (
      <p>
        To the fullest extent the law allows, {OPERATOR} won’t be liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, clients, data or
        goodwill, arising from your use of {NAME}. Our total liability for any claim relating to {NAME} is limited to the greater of the amount you paid us for {NAME} in the 12 months before the claim
        or US$100. Some places don’t allow these limits, so they may not all apply to you.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Your responsibility for claims",
    body: (
      <p>
        You agree to defend and indemnify {OPERATOR} against claims, losses and costs (including reasonable legal fees) arising from your content, what you publish, your breach of these terms, or your
        violation of any law or the rights of others.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of the United States and of the state in which {OPERATOR} is organized, without regard to conflict-of-law rules. Disputes will be resolved in the state or
        federal courts located there, unless the law requires otherwise. Before filing a claim, please contact us so we can try to resolve it informally.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms as {NAME} changes. We’ll change the date at the top, and for significant changes we’ll tell you in the app or by email before they take effect. If you keep using{" "}
        {NAME} after that, you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. {OPERATOR}, operator of {NAME}.
      </p>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of service" effective={EFFECTIVE} sections={SECTIONS} />;
}
