# Strapi Plugin Better Auth

Detailed Multi-Factor Authentication (MFA) plugin for Strapi v5+. Secure your Strapi Admin panel with TOTP-based 2FA, fully integrated into the Strapi interface.

## Features

- **MFA Login Interception**: Seamlessly integrates with the default Strapi login flow.
- **TOTP Compatibility**: Works with all major authenticator apps (Google Authenticator, Authy, 1Password, etc.).
- **Recovery Codes**: Generates secure recovery codes for emergency access.
- **Native UI Integration**: 
  - Matches Strapi's design system.
  - Profile integration for easy setup.
  - Dedicated verification page.
- **Global Configuration**:
  - Enable/Disable globally.
  - Custom "Issuer" name for authenticator apps.
- **Role-Based Access Control**: Granular permissions for managing plugin settings.
- **Multi-language Support**: Fully localized interface.

## Installation

To install this plugin, you'll need to include it in your Strapi project.

1. **Install the dependency** (if published to npm) or link the local plugin.
2. **Enable the plugin** in `config/plugins.ts`:

```typescript
export default {
  // ...
  'better-auth': {
    enabled: true,
    resolve: './src/plugins/better-auth', // If local
  },
  // ...
};
```

3. **Build the admin panel**:
```bash
npm run build
```

4. **Restart Strapi**:
```bash
npm run develop
```

## Configuration

Access the global settings via the admin panel:
**Settings** -> **Global Settings** -> **Better Auth Settings**

| Option | Description |
|--------|-------------|
| **Enabled** | Master switch to enable or disable the MFA interception logic globally. |
| **Enforce** | *(Coming Soon)* Force all users to set up MFA before accessing the dashboard. |
| **Issuer** | The name that appears in the authenticator app (e.g., "My Project"). Defaults to "Strapi". |

### Permissions
Go to **Settings** -> **Administration Panel** -> **Roles** to configure who can manage these settings:
- `plugins::better-auth.settings.read`: View configuration.
- `plugins::better-auth.settings.update`: Modify configuration.

## User Guide

### Setting up MFA (User)
1. Log in to the Strapi Admin panel.
2. Click on your **User Profile** avatar in the top-right corner.
3. Click **Profile**.
4. In the "Better Auth" section, toggle the switch to **Enable MFA**.
5. A modal will appear:
   - **Scan the QR Code** with your authenticator app.
   - Enter the **6-digit code** displayed in your app.
   - **Save your Recovery Codes** in a safe place. You will not see them again!
6. Click **Finish**.

### Signing In
1. Enter your Email and Password on the standard Strapi login page.
2. If credentials are correct and MFA is enabled, you will be redirected to the Verification Page.
3. Enter the code from your authenticator app.
4. Upon success, you will be redirected to the dashboard.

## Roadmap & Status

Below is the implementation status of planned features.

- [x] **MFA Login**: Intercepts admin login securely.
- [x] **Recovery Codes**: Backup access method.
- [x] **TOTP App Compatibility**: Standard RFC 6238 implementation.
- [x] **Integrated Setup Screen**: User-friendly wizard in profile settings.
- [x] **MFA Page Matches Theme**: Consistent UI/UX.
- [x] **Custom Issuer**: Configurable app label.
- [x] **Multi-language Support**: i18n ready.
- [ ] **Email Passcode**: Alternative MFA method via Email.
- [ ] **Enforced Mode**: Mandatory MFA for specific roles or all users.
- [ ] **Admin Reset**: Allow super-admins to reset MFA for other users who lost access.
