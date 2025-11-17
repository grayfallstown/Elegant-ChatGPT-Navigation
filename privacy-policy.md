# Privacy Policy for “Elegant ChatGPT Navigation”

_Last updated: 2025-11-17_

This Privacy Policy explains how the **“Elegant ChatGPT Navigation”** browser extension (“the Extension”, “we”, “us”, “our”) handles information when you use it with ChatGPT.

The Extension is designed with **privacy by default**: all processing happens locally in your browser. We do **not** collect, store, or transmit your conversation data to our own servers.

---

## 1. Scope of this Policy

This Policy applies only to the **browser extension** “Elegant ChatGPT Navigation”.

It **does not** apply to:

- The ChatGPT service itself (operated by OpenAI or other providers)
- The PayPal donation page
- External hosting services that provide static assets (e.g. images/icons)
- Any other websites or services you visit

Those are covered by their own privacy policies.

---

## 2. What the Extension Does

The Extension enhances the ChatGPT interface by adding a navigation panel that shows:

- Your **prompts** (user messages)
- The assistant’s **responses**
- **Headings (H1)** inside responses
- **Code blocks** (with language and small previews)

To do this, the Extension:

- Reads the visible content of the ChatGPT page in your browser
- Builds an internal navigation tree in memory
- Scrolls the ChatGPT view to the right position when you click on an item

All of this happens **locally** inside your browser tab.

---

## 3. Data We Access and Process

The Extension only interacts with content on the pages it is allowed to run on:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

Within those pages, the Extension can access:

- Message content (prompts and responses)
- Headings and code blocks inside responses
- Layout and scrolling information (positions, sizes, scroll offsets)

This information is used **only** to:

- Build and update the navigation tree
- Keep the navigation panel in sync with your scroll position
- Scroll the chat view to a selected message, heading, or code block

> **Important:**  
> The Extension does **not** send this content anywhere.  
> It remains in your browser’s memory and is discarded when you close the tab or disable/uninstall the Extension.

---

## 4. No Data Collection, No Analytics, No Tracking

The Extension:

- ❌ Does **not** collect or upload any of your chat content
- ❌ Does **not** send any data to custom backend servers or APIs
- ❌ Does **not** use analytics tools
- ❌ Does **not** set or read cookies
- ❌ Does **not** log your prompts, responses, or navigation usage

There is **no** user account, login, telemetry, or profiling associated with this Extension.

---

## 5. Local Storage and Persistence

The current version of the Extension:

- Does **not** use `localStorage`, `sessionStorage`, browser sync storage, or other persistent storage for your chat content
- Does **not** store conversation text, headings, or code blocks on disk

All processing happens in **temporary memory** and is lost when:

- You close the ChatGPT tab
- You reload the page
- You disable or uninstall the Extension
- You close the browser

---

## 6. Third-Party Services

Although the Extension itself does not transmit your chat content, your browser may communicate with third-party services in the following situations:

### 6.1. Static Icon Hosting (`grayfallstown.sirv.com`)

The Extension loads static image assets (e.g. the panel logo and/or donate banner) from:

- `https://grayfallstown.sirv.com/...`

When your browser requests these images:

- Your browser sends a standard HTTP(S) request to that server
- That server may receive technical information such as your IP address, browser type, and time of access
- **No conversation content** is included in these image URLs

Please refer to the privacy policy of the respective hosting provider for details on how they handle this technical data.

### 6.2. PayPal Donation Link

The navigation header includes an **optional donate button** that opens a PayPal donation page:

- `https://www.paypal.com/donate/?hosted_button_id=HDW4PAEKX7VUJ`

This is a **plain hyperlink**. It is only triggered if you click the donate button.

When you open the PayPal page:

- You leave the scope of this Extension and enter PayPal’s service
- PayPal’s own privacy policy and terms apply
- The Extension does **not** receive any details about your PayPal account, payment method, or donation history

The Extension does **not** automatically contact PayPal or send any chat content to PayPal.

---

## 7. Permissions

According to the extension manifest, the Extension uses:

- `host_permissions`:
  - `https://chatgpt.com/*`
  - `https://chat.openai.com/*`

These permissions are required so that the Extension can:

- Read and analyze the content of ChatGPT pages
- Insert the navigation panel into the ChatGPT interface
- Control scrolling within the ChatGPT view

The Extension does **not** request broad permissions such as:

- Access to all websites
- Access to your file system
- Access to browser history
- Access to cookies or passwords

---

## 8. Children’s Privacy

This Extension is intended for use by **adults and general users** of ChatGPT.

It does not:

- Target children
- Intentionally collect personal information from children
- Provide content specifically directed to children

If you believe that the Extension has inadvertently been used to collect personal information from a child, please reach out via the contact section below so that we can address the situation.

---

## 9. Changes to this Privacy Policy

We may update this Privacy Policy from time to time, for example when:

- The Extension gains new features
- The permissions or external services change
- Legal requirements evolve

When the policy changes, the **“Last updated”** date at the top of this document will be revised.  
If you continue to use the Extension after the updated Policy is published, you agree to the new terms.

---

## 10. Contact

If you have questions or concerns about this Privacy Policy or about how the Extension handles data, you can contact the developer using the contact information maklemenz@googlemail.com:

Please include “Elegant ChatGPT Navigation – Privacy” in your message so it can be identified quickly.

