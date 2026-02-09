// Types
import type { Schema, Struct } from '@strapi/strapi';

interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: { draftAndPublish: false };
  pluginOptions: {
    'content-manager': { visible: false };
    'content-type-builder': { visible: false };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> & Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

interface PluginBetterAuthBetterAuthConfig extends Struct.SingleTypeSchema {
  collectionName: 'better-auth-config';
  info: {
    displayName: 'Better Auth Config';
    pluralName: 'better-auth-configs';
    singularName: 'better-auth-config';
  };
  options: { draftAndPublish: false };
  pluginOptions: {
    'content-manager': { visible: false };
    'content-type-builder': { visible: false };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    enforce: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    issuer: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Strapi'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::better-auth.better-auth-config'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
  };
}

export interface PluginBetterAuthMfaTemp extends Struct.CollectionTypeSchema {
  collectionName: 'mfa-temps';
  info: {
    displayName: 'MFA Temp';
    pluralName: 'mfa-temps';
    singularName: 'mfa-temp';
  };
  options: { draftAndPublish: false };
  pluginOptions: {
    'content-manager': { visible: false };
    'content-type-builder': { visible: false };
  };
  attributes: {
    admin_user: Schema.Attribute.Relation<'oneToOne', 'admin::user'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'plugin::better-auth.mfa-temp'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    secret: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
  };
}

export interface PluginBetterAuthMfaToken extends Struct.CollectionTypeSchema {
  collectionName: 'mfa-tokens';
  info: {
    displayName: 'MFA Token';
    pluralName: 'mfa-tokens';
    singularName: 'mfa-token';
  };
  options: { draftAndPublish: false };
  pluginOptions: {
    'content-manager': { visible: false };
    'content-type-builder': { visible: false };
  };
  attributes: {
    admin_user: Schema.Attribute.Relation<'oneToOne', 'admin::user'>;
    counter: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
    digits: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<6>;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'plugin::better-auth.mfa-token'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    recovery_codes: Schema.Attribute.JSON & Schema.Attribute.Private;
    secret: Schema.Attribute.String & Schema.Attribute.Required & Schema.Attribute.Private;
    type: Schema.Attribute.Enumeration<['totp', 'hotp']> & Schema.Attribute.DefaultTo<'totp'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> & Schema.Attribute.Private;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ContentTypeSchemas {
      'admin::user': AdminUser;
      'plugin::better-auth.better-auth-config': PluginBetterAuthBetterAuthConfig;
      'plugin::better-auth.mfa-temp': PluginBetterAuthMfaTemp;
      'plugin::better-auth.mfa-token': PluginBetterAuthMfaToken;
    }
  }
}
