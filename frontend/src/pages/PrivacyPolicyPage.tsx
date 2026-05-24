import React from "react";
import { T, panel } from "../theme";

const EFFECTIVE_DATE = "May 24, 2026";
const CONTACT_EMAIL = "support@tcg-singularity.com";

const PrivacyPolicyPage: React.FC = () => (
  <div style={{ maxWidth: 760 }}>
    <h1 style={{ marginBottom: "0.4em" }}>Privacy Policy</h1>
    <p style={{ color: T.textDim, fontSize: 13, marginBottom: "1.5em" }}>
      Effective {EFFECTIVE_DATE}
    </p>

    <div style={{ ...panel, marginBottom: "1.5em" }}>
      <p style={{ color: T.text, lineHeight: 1.6 }}>
        TCG Builder (“we”, “us”, “the app”) is a hobby project that provides
        deck-building, card-browsing, and collection-tracking tools for
        Magic: The Gathering and Riftbound. This policy explains what
        information we collect, why we collect it, and what we do with it.
        It applies to both the website and the Android app.
      </p>
    </div>

    <Section title="Information we collect">
      <p>
        <b>Account information.</b> When you register, we store your username,
        email address (if provided), and a password. Passwords are hashed with
        bcrypt before being stored — we never store or have access to your
        plain-text password.
      </p>
      <p>
        <b>User content.</b> Decks you save (MTG and Riftbound) and entries in
        your card collection (card id, quantity, foil flag) are stored under
        your account so you can access them across sessions.
      </p>
      <p>
        <b>Authentication tokens.</b> When you log in we issue a JSON Web
        Token (JWT) that your browser or app stores locally. The token expires
        after 24 hours and is sent with each request to prove you are signed
        in. We do not use third-party tracking cookies.
      </p>
      <p>
        <b>Camera images (card scanning).</b> If you use the “Scan Card”
        feature in the Android app, your device camera captures a single
        frame which is sent to our server. We compute a small perceptual
        hash of the image, compare it against our card database, and return
        the closest matches. The uploaded image is processed in memory and is
        not persisted to disk or shared with anyone. We never access your
        camera without you opening the scan page.
      </p>
      <p>
        <b>Purchase data.</b> If you buy the optional “Remove Ads” upgrade in
        the Android app, the purchase is handled by Google Play Billing. We
        receive only the token needed to verify the purchase; we do not
        receive your payment-card details.
      </p>
      <p>
        <b>Server logs.</b> Our server records standard request logs (IP
        address, timestamp, requested endpoint, response status) for
        operational and security purposes. Logs are not used for advertising
        and are retained only as long as needed for debugging and abuse
        prevention.
      </p>
    </Section>

    <Section title="How we use your information">
      <ul style={{ paddingLeft: "1.2em", lineHeight: 1.6 }}>
        <li>To create your account and let you sign in.</li>
        <li>To save and load your decks and card collection.</li>
        <li>To identify cards you photograph with the scan feature.</li>
        <li>To verify in-app purchases and disable ads for paying users.</li>
        <li>To monitor and protect the service from abuse.</li>
      </ul>
      <p>
        We do <b>not</b> sell your personal information. We do not use your
        decks, collection, or scanned images to train any machine-learning
        model.
      </p>
    </Section>

    <Section title="Third-party services">
      <p>
        <b>Google AdMob (Android) and Google AdSense (web).</b> The free
        version of the app shows ads served by Google. These services may
        collect device identifiers (such as the Android Advertising ID) and
        usage information to serve and measure ads. See{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: T.gold }}>
          Google’s Privacy Policy
        </a>
        . You can opt out of personalised ads on Android via{" "}
        <i>Settings → Google → Ads</i>.
      </p>
      <p>
        <b>Google Play Billing.</b> Used to process the optional “Remove Ads”
        purchase. Governed by Google Play’s terms and privacy policy.
      </p>
      <p>
        <b>Card data sources.</b> Card information is sourced from Scryfall
        (Magic: The Gathering) and RiftScribe (Riftbound). When the app
        displays a card image, your browser may load the image from those
        services.
      </p>
    </Section>

    <Section title="Data retention and deletion">
      <p>
        Your account data is retained for as long as your account exists. You
        can change your password at any time on the Profile page. If you
        would like your account and associated data deleted, email us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: T.gold }}>
          {CONTACT_EMAIL}
        </a>
        {" "}from the email address tied to the account and we will remove
        it within 30 days.
      </p>
    </Section>

    <Section title="Children">
      <p>
        TCG Builder is not directed at children under 13. We do not knowingly
        collect personal information from children. If you believe a child has
        provided us with personal information, please contact us so we can
        remove it.
      </p>
    </Section>

    <Section title="Security">
      <p>
        Passwords are hashed with bcrypt. Traffic between your device and our
        server is encrypted with HTTPS. No method of transmission or storage
        is perfectly secure, but we take reasonable steps to protect your
        information.
      </p>
    </Section>

    <Section title="Changes to this policy">
      <p>
        We may update this policy from time to time. Material changes will be
        reflected by a new effective date at the top of this page. Continued
        use of the service after a change constitutes acceptance of the
        updated policy.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions, deletion requests, or privacy concerns:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: T.gold }}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </Section>

    <p style={{ color: T.textDim, fontSize: 12, marginTop: "2em" }}>
      Magic: The Gathering is a trademark of Wizards of the Coast. Riftbound
      is a trademark of Riot Games. TCG Builder is not affiliated with,
      endorsed, sponsored, or specifically approved by either company.
    </p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ ...panel, marginBottom: "1.2em" }}>
    <h2 style={{ fontSize: "1em", color: T.gold, letterSpacing: "0.06em", marginBottom: "0.8em", textTransform: "uppercase" }}>
      {title}
    </h2>
    <div style={{ color: T.text, lineHeight: 1.6, fontSize: 14 }}>{children}</div>
  </div>
);

export default PrivacyPolicyPage;
