export interface DtiRegistration {
  businessName: string;
  registrationNo: string;
  registeredOwner: string;
  scopeLocation: string;
  validity: string;
  dateIssued: string;
  certificateUrl: string;
}

export interface CompanyConfig {
  name: string;
  platformName: string;
  founderCeo: string;
  mobile: string;
  mobileLink: string;
  configurableEmail: string;
  logoUrl: string;
  brandBoardUrl: string;
  dtiCertificateUrl: string;
  dti: DtiRegistration;
  address: {
    line1: string;
    line2: string;
    zone: string;
    cityPostal: string;
    fullFormatted: string;
    mapsUrl: string;
  };
  headline: string;
  subheadline: string;
  heroDescription: string;
}

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? (import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`)
  : './';

export const LOGO_URL = `${baseUrl}assets/aistudio/OPHIREUM_Logo_6504e623.png`;
export const BRAND_BOARD_URL = `${baseUrl}assets/aistudio/Ophireum_Multimedia_Tech_Brand_Board_aa50d48b.png`;
export const DTI_CERTIFICATE_URL = `${baseUrl}images/dti-business-registration.png`;

export const COMPANY_CONFIG: CompanyConfig = {
  name: 'OPHIREUM MULTIMEDIA PRODUCTION',
  platformName: 'OPHIREUM NETWORK',
  founderCeo: 'Dhenze Languisan',
  mobile: '+63 917 966 8814',
  mobileLink: 'tel:+639179668814',
  configurableEmail: 'contact@ophireum.network',
  logoUrl: LOGO_URL,
  brandBoardUrl: BRAND_BOARD_URL,
  dtiCertificateUrl: DTI_CERTIFICATE_URL,
  dti: {
    businessName: 'OPHIREUM MULTIMEDIA PRODUCTION',
    registrationNo: '7567003',
    registeredOwner: 'LEODENIS DEVEZA LANGUISAN',
    scopeLocation: 'Mabalacat City, Pampanga, Region III (Central Luzon)',
    validity: '06 November 2025 to 06 November 2030',
    dateIssued: '06 November 2025',
    certificateUrl: DTI_CERTIFICATE_URL
  },
  address: {
    line1: 'KMC | One West Aeropark',
    line2: '5th Floor & Penthouse, One West Aeropark',
    zone: 'Clark Freeport Zone, Mabalacat City',
    cityPostal: '2010 Pampanga, Philippines',
    fullFormatted: 'KMC | One West Aeropark, 5th Floor & Penthouse, Clark Freeport Zone, Mabalacat City, 2010 Pampanga, Philippines',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=One+West+Aeropark+Clark+Freeport+Zone+Mabalacat+Pampanga+Philippines'
  },
  headline: 'OPHIREUM MULTIMEDIA PRODUCTION',
  subheadline: 'Intelligent Technology. Creative Innovation. Connected Digital Solutions.',
  heroDescription: 'Transforming digital experiences through multimedia production, artificial intelligence, enterprise software engineering, creative technology, and intelligent digital platforms.'
};
