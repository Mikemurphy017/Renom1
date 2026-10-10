import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

const { operator: OPERATOR, contact: CONTACT } = LEGAL;
const EFFECTIVE = "October 10, 2026";
const NAME = BRAND.name;

export const metadata: Metadata = {
  title: { absolute: `Privacy policy · ${NAME}` },
  description: `How ${NAME} collects, uses and protects your information.`,
};

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          {NAME} (“{NAME}”, “we”, “us”) is a video studio for financial advisors, operated by {OPERATOR}. This policy explains what information we collect when you use our website and
          studio, how we use it, who we share it with and the choices you have. It applies to renom.video, renom-ai.com and the {NAME} app.
        </p>
        <p>
          When an advisor uses {NAME} on behalf of a firm, the advisor and the firm decide what goes into their videos and posts. We process that content to provide the service to them.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We collect only what the studio needs to work:</p>
        <ul>
          <li><strong>Account details:</strong> your name and email address, and your password, which we store only as a one-way hash (we never see or store the password itself).</li>
          <li><strong>Your profile and voice settings:</strong> what you tell us about your practice, clients, tone, credentials, firm name, brand colors and disclosures, so scripts and captions sound like you and include your disclosure.</li>
          <li><strong>Content you create:</strong> ideas, scripts, the video and audio you record, transcripts, captions, cover images, headshots and media you upload, and the post copy you write or approve.</li>
          <li><strong>Posting records:</strong> what you posted or scheduled, where, when and with which disclosure, so you have an archive of what went out.</li>
          <li><strong>Connected accounts:</strong> if you connect your own Buffer account, the access tokens Buffer gives us (stored encrypted) and the names of the channels in your Buffer.</li>
          <li><strong>Technical information:</strong> basic logs our hosting provider keeps when you use the site (such as IP address, browser type and the pages requested), used to keep the service running and secure.</li>
        </ul>
        <p>We don’t ask for, and you shouldn’t put into {NAME}, clients’ personal or account information.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To provide the studio: write ideas, scripts, captions and cover lines, edit your recordings, build covers, and post or schedule videos when you ask us to.</li>
        <li>To run your account: sign-in, password resets, and messages about the service.</li>
        <li>To keep {NAME} secure and working: preventing abuse, fixing problems and understanding what needs improving.</li>
        <li>When our team posts for you, to prepare and schedule those posts, and to review how they perform so we can suggest what to make next.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <>
        <p>
          {NAME} uses AI providers to do some of its work. When you use these features, the content needed for the task is sent to the provider, which processes it to return the result:
        </p>
        <ul>
          <li><strong>Writing</strong> (ideas, scripts, captions, taglines, cover lines): your profile, voice settings and the video’s script or topic go to Anthropic (Claude).</li>
          <li><strong>AI cover scenes:</strong> the photo you choose (a headshot or a frame from your video) and the video’s topic go to Google (Gemini), which returns a new image of you.</li>
        </ul>
        <p>
          Speech recognition for captions runs on our own servers. We don’t sell your content, and we don’t use it to train AI models. AI output can be wrong: you review scripts, captions and images before
          anything is posted.
        </p>
      </>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>We don’t sell or rent your personal information, and we don’t share it for advertising. We share it only with service providers that help us run {NAME}, and only what they need:</p>
        <ul>
          <li><strong>Railway</strong>: hosting, databases and file storage.</li>
          <li><strong>Anthropic</strong> and <strong>Google</strong>: the AI features described above.</li>
          <li><strong>Buffer</strong>: posting and scheduling, through our team’s account or your own connected account.</li>
          <li><strong>Email providers</strong>: sending password resets and invitations.</li>
          <li><strong>Pexels</strong>: when an edit style adds stock b-roll, we send search terms (not your video) to find clips.</li>
          <li><strong>Video processing providers</strong>, when one is used to edit your recording.</li>
        </ul>
        <p>
          The social networks you post to (such as LinkedIn, YouTube, Instagram, Facebook, TikTok and X) receive the videos and captions you publish, under their own privacy policies. We may also
          disclose information if the law requires it, to protect our rights or users’ safety, or as part of a merger or sale of the business, in which case this policy continues to apply.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use a small number of cookies that are needed for {NAME} to work: one that keeps you signed in, and a short-lived one that protects the connection when you link your Buffer account. Your
        browser may also keep drafts on your device so work isn’t lost. We don’t use advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep your account and content while your account is open, so your studio, videos and archive are there when you come back. Settings → “Start over” clears your profile, videos and settings.
        If you ask us to delete your account, we delete your information within 30 days, except records we must keep for legal, security or accounting reasons, and copies in backups that expire on
        their normal schedule. Posts already published on social networks stay there until you remove them.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Connections to {NAME} are encrypted (HTTPS). Passwords are stored only as hashes, and connected-account tokens and other credentials are encrypted and kept on our servers, never in your
        browser. Each advisor’s studio, connected accounts and posts are kept separate from every other advisor’s. No system is perfectly secure, but we work to protect your information and will tell
        you if a breach affects you, as the law requires.
      </p>
    ),
  },
  {
    id: "choices",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can see and edit most of your information in the studio, download your videos at any time, and disconnect your Buffer account from Settings. You can also ask us to:</p>
        <ul>
          <li>tell you what personal information we hold about you and give you a copy;</li>
          <li>correct or delete it; or</li>
          <li>stop processing it for a particular purpose.</li>
        </ul>
        <p>
          Depending on where you live (for example California, or the EU and UK), you may have additional rights under local law. We don’t sell or share personal information for cross-context
          advertising. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we’ll respond within the time the law requires. We won’t treat you differently for exercising your rights.
        </p>
      </>
    ),
  },
  {
    id: "compliance",
    title: "Regulated advisors",
    body: (
      <p>
        {NAME} adds your disclosures, can route posts to a reviewer and keeps an archive of what you publish. These tools support, but don’t replace, your own and your firm’s recordkeeping and
        compliance obligations.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>{NAME} is for professionals and isn’t directed to anyone under 18. We don’t knowingly collect information from children.</p>,
  },
  {
    id: "international",
    title: "Where your information is processed",
    body: <p>{NAME} is run from the United States, and our providers may process information in the United States and other countries, with appropriate safeguards where the law requires them.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>We’ll update this page if our practices change and change the date at the top. If a change is significant, we’ll tell you in the app or by email before it takes effect.</p>,
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions or requests about privacy: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. {OPERATOR}, operator of {NAME}. See also our <a href="/terms">Terms of Service</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" effective={EFFECTIVE} sections={SECTIONS} />;
}
