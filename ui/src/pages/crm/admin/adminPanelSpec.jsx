// Mirror of EspoCRM `application/Espo/Resources/metadata/app/adminPanel.json`.
// Items group into sections; each item has a stable `key` used for routing
// and for mapping to a React implementation (when present).
//
// `espoUrl` is the Espo deep-link path (hash portion) used as a fallback for
// sections not yet re-implemented natively — opens in a new tab.

import {
  Settings as SettingsIcon,
  Monitor as DesktopIcon,
  Login as SignInIcon,
  Schedule as ClockIcon,
  Euro as CurrencyIcon,
  Notifications as BellIcon,
  Hub as NetworkIcon,
  CloudUpload as UploadIcon,
  Dns as ServerIcon,
  FormatListBulleted as ListIcon,
  SystemUpdateAlt as UpgradeIcon,
  CleaningServices as BroomIcon,
  Storage as DatabaseIcon,
  Person as UserIcon,
  Groups as UsersIcon,
  VpnKey as KeyIcon,
  Security as ShieldIcon,
  History as HistoryIcon,
  ManageAccounts as UserCogIcon,
  Build as ToolsIcon,
  TableChart as TableIcon,
  Translate as LanguageIcon,
  MarkEmailRead as EnvelopeOpenIcon,
  Send as PaperPlaneIcon,
  Email as EnvelopeIcon,
  Inbox as InboxIcon,
  FilterAlt as FilterIcon,
  Folder as FolderIcon,
  Drafts as EnvelopeSquareIcon,
  LocalParking as ParkingIcon,
  EventNote as CalendarAltIcon,
  Dashboard as ThLargeIcon,
  Badge as IdCardIcon,
  PictureAsPdf as FilePdfIcon,
  Share as ShareIcon,
  Flag as FlagIcon,
  FileDownload as FileImportIcon,
  AttachFile as PaperclipIcon,
  Phone as PhoneIcon,
  Timeline as TimelineIcon,
  Assignment as LogIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

export const ADMIN_SECTIONS = [
  {
    key: 'system',
    label: 'System',
    items: [
      { key: 'settings',           label: 'Settings',             espoUrl: '#Admin/settings',           desc: 'System settings of application.',                 icon: <SettingsIcon /> },
      { key: 'userInterface',      label: 'User Interface',       espoUrl: '#Admin/userInterface',      desc: 'Configure UI.',                                   icon: <DesktopIcon /> },
      { key: 'authentication',     label: 'Authentication',       espoUrl: '#Admin/authentication',     desc: 'Authentication settings.',                        icon: <SignInIcon /> },
      { key: 'scheduledJobs',      label: 'Scheduled Jobs',       espoUrl: '#ScheduledJob',             desc: 'Jobs which are executed by cron.',                icon: <ClockIcon /> },
      { key: 'currency',           label: 'Currency',             espoUrl: '#Admin/currency',           desc: 'Currency settings and rates.',                    icon: <CurrencyIcon /> },
      { key: 'notifications',      label: 'Notifications',        espoUrl: '#Admin/notifications',      desc: 'In-app and email notification settings.',         icon: <BellIcon /> },
      { key: 'integrations',       label: 'Integrations',         espoUrl: '#Admin/integrations',       desc: 'Integration with third-party services.',          icon: <NetworkIcon /> },
      { key: 'extensions',         label: 'Extensions',           espoUrl: '#Admin/extensions',         desc: 'Install or uninstall extensions.',                icon: <UploadIcon /> },
      { key: 'systemRequirements', label: 'System Requirements',  espoUrl: '#Admin/systemRequirements', desc: 'System Requirements for EspoCRM.',                icon: <ServerIcon /> },
      { key: 'jobsSettings',       label: 'Job Settings',         espoUrl: '#Admin/jobsSettings',       desc: 'Job processing settings. Jobs execute tasks in the background.', icon: <ListIcon /> },
      { key: 'upgrade',            label: 'Upgrade',              espoUrl: '#Admin/upgrade',            desc: 'Upgrade EspoCRM.',                                icon: <UpgradeIcon /> },
      { key: 'clearCache',         label: 'Clear Cache',          action: 'clearCache',                 desc: 'Clear all backend cache.',                        icon: <BroomIcon /> },
      { key: 'rebuild',            label: 'Rebuild',              action: 'rebuild',                    desc: 'Rebuild backend and clear cache.',                icon: <DatabaseIcon /> },
    ],
  },
  {
    key: 'users',
    label: 'Users',
    items: [
      { key: 'users',         label: 'Users',          espoUrl: '#Admin/users',         desc: 'Users management.',                                   icon: <UserIcon /> },
      { key: 'teams',         label: 'Teams',          espoUrl: '#Admin/teams',         desc: 'Teams management.',                                   icon: <UsersIcon /> },
      { key: 'roles',         label: 'Roles',          espoUrl: '#Admin/roles',         desc: 'Roles management.',                                   icon: <KeyIcon /> },
      { key: 'authLog',       label: 'Auth Log',       espoUrl: '#Admin/authLog',       desc: 'Login history.',                                      icon: <SignInIcon /> },
      { key: 'authTokens',    label: 'Auth Tokens',    espoUrl: '#Admin/authTokens',    desc: 'Active auth sessions. IP address and last access date.', icon: <ShieldIcon /> },
      { key: 'actionHistory', label: 'Action History', espoUrl: '#Admin/actionHistory', desc: 'Log of user actions.',                                icon: <HistoryIcon /> },
      { key: 'apiUsers',      label: 'API Users',      espoUrl: '#Admin/apiUsers',      desc: 'Separate users for integration purposes.',            icon: <UserCogIcon /> },
    ],
  },
  {
    key: 'customization',
    label: 'Customization',
    items: [
      { key: 'entityManager',   label: 'Entity Manager',   espoUrl: '#Admin/entityManager',   desc: 'Create and edit custom entities. Manage fields and relationships.', icon: <ToolsIcon /> },
      { key: 'layouts',         label: 'Layout Manager',   espoUrl: '#Admin/layouts',         desc: 'Customize layouts (list, detail, edit, search, mass update).',      icon: <TableIcon /> },
      { key: 'labelManager',    label: 'Label Manager',    espoUrl: '#Admin/labelManager',    desc: 'Customize application labels.',                                     icon: <LanguageIcon /> },
      { key: 'templateManager', label: 'Template Manager', espoUrl: '#Admin/templateManager', desc: 'Customize message templates.',                                      icon: <EnvelopeOpenIcon /> },
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    items: [
      { key: 'outboundEmails',        label: 'Outbound Emails',        espoUrl: '#Admin/outboundEmails',        desc: 'SMTP settings for outgoing emails.',                       icon: <PaperPlaneIcon /> },
      { key: 'inboundEmails',         label: 'Inbound Emails',         espoUrl: '#Admin/inboundEmails',         desc: 'Settings for incoming emails.',                            icon: <EnvelopeIcon /> },
      { key: 'groupEmailAccounts',    label: 'Group Email Accounts',   espoUrl: '#Admin/groupEmailAccounts',    desc: 'Group IMAP email accounts. Email import and Email-to-Case.', icon: <InboxIcon /> },
      { key: 'personalEmailAccounts', label: 'Personal Email Accounts', espoUrl: '#Admin/personalEmailAccounts', desc: "Users email accounts.",                                    icon: <InboxIcon /> },
      { key: 'emailFilters',          label: 'Email Filters',          espoUrl: '#Admin/emailFilters',          desc: "Email messages that match the specified filter won't be imported.", icon: <FilterIcon /> },
      { key: 'groupEmailFolders',     label: 'Group Email Folders',    espoUrl: '#Admin/groupEmailFolders',     desc: 'Email folders shared for teams.',                          icon: <FolderIcon /> },
      { key: 'emailTemplates',        label: 'Email Templates',        espoUrl: '#Admin/emailTemplates',        desc: 'Templates for outbound emails.',                           icon: <EnvelopeSquareIcon /> },
      { key: 'sms',                   label: 'SMS',                    espoUrl: '#Admin/sms',                   desc: 'SMS settings.',                                            icon: <PaperPlaneIcon /> },
    ],
  },
  {
    key: 'portal',
    label: 'Portal',
    items: [
      { key: 'portals',     label: 'Portals',      espoUrl: '#Admin/portals',     desc: 'Portals management.',  icon: <ParkingIcon /> },
      { key: 'portalUsers', label: 'Portal Users', espoUrl: '#Admin/portalUsers', desc: 'Users of portal.',     icon: <UserIcon /> },
      { key: 'portalRoles', label: 'Portal Roles', espoUrl: '#Admin/portalRoles', desc: 'Roles for portal.',    icon: <KeyIcon /> },
    ],
  },
  {
    key: 'setup',
    label: 'Setup',
    items: [
      { key: 'workingTimeCalendar',    label: 'Working Time Calendars',   espoUrl: '#Admin/workingTimeCalendar',    desc: 'Working schedule.',                                      icon: <CalendarAltIcon /> },
      { key: 'layoutSets',             label: 'Layout Sets',              espoUrl: '#Admin/layoutSets',             desc: 'Collections of layouts that can be assigned to teams & portals.', icon: <TableIcon /> },
      { key: 'dashboardTemplates',     label: 'Dashboard Templates',      espoUrl: '#Admin/dashboardTemplates',     desc: 'Deploy dashboards to users.',                            icon: <ThLargeIcon /> },
      { key: 'leadCapture',            label: 'Lead Capture',             espoUrl: '#Admin/leadCapture',            desc: 'Lead capture endpoints and web forms.',                  icon: <IdCardIcon /> },
      { key: 'pdfTemplates',           label: 'PDF Templates',            espoUrl: '#Admin/pdfTemplates',           desc: 'Templates for printing to PDF.',                         icon: <FilePdfIcon /> },
      { key: 'webhooks',               label: 'Webhooks',                 espoUrl: '#Admin/webhooks',               desc: 'Manage webhooks.',                                       icon: <ShareIcon /> },
      { key: 'addressCountries',       label: 'Address Countries',        espoUrl: '#Admin/addressCountries',       desc: 'Countries available for address fields.',                icon: <FlagIcon /> },
      { key: 'authenticationProviders', label: 'Authentication Providers', espoUrl: '#Admin/authenticationProviders', desc: 'Additional authentication providers for portals.',       icon: <SignInIcon /> },
    ],
  },
  {
    key: 'data',
    label: 'Data',
    items: [
      { key: 'import',         label: 'Import',          espoUrl: '#Admin/import',         desc: 'Import data from CSV file.',                                   icon: <FileImportIcon /> },
      { key: 'attachments',    label: 'Attachments',     espoUrl: '#Admin/attachments',    desc: 'All file attachments stored in the system.',                   icon: <PaperclipIcon /> },
      { key: 'jobs',           label: 'Jobs',            espoUrl: '#Admin/jobs',           desc: 'Jobs execute tasks in the background.',                        icon: <ListIcon /> },
      { key: 'emailAddresses', label: 'Email Addresses', espoUrl: '#Admin/emailAddresses', desc: 'All email addresses stored in the system.',                    icon: <EnvelopeIcon /> },
      { key: 'phoneNumbers',   label: 'Phone Numbers',   espoUrl: '#Admin/phoneNumbers',   desc: 'All phone numbers stored in the system.',                      icon: <PhoneIcon /> },
      { key: 'appSecrets',     label: 'App Secrets',     espoUrl: '#Admin/appSecrets',     desc: 'Store sensitive information like API keys, passwords, and other secrets.', icon: <KeyIcon /> },
      { key: 'oAuthProviders', label: 'OAuth Providers', espoUrl: '#Admin/oAuthProviders', desc: 'OAuth providers for integrations.',                            icon: <SignInIcon /> },
      { key: 'pipelines',      label: 'Pipelines',       espoUrl: '#Admin/pipelines',      desc: 'Configure multiple pipelines.',                                icon: <TimelineIcon /> },
      { key: 'appLog',         label: 'App Log',         espoUrl: '#Admin/appLog',         desc: 'Application log.',                                             icon: <LogIcon /> },
    ],
  },
  {
    key: 'misc',
    label: 'Misc',
    items: [
      { key: 'formulaSandbox', label: 'Formula Sandbox', espoUrl: '#Admin/formulaSandbox', desc: 'Write and test formula scripts.', icon: <CodeIcon /> },
    ],
  },
];

export const ESPO_BASE_URL = import.meta.env.VITE_ESPO_URL || 'http://localhost:7080';

export function espoDeepLink(item) {
  if (!item?.espoUrl) return null;
  return `${ESPO_BASE_URL}/${item.espoUrl.startsWith('#') ? item.espoUrl : '#' + item.espoUrl}`;
}

export function findAdminItem(key) {
  for (const section of ADMIN_SECTIONS) {
    const hit = section.items.find((i) => i.key === key);
    if (hit) return { section, item: hit };
  }
  return null;
}
