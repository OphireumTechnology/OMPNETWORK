export interface CompanyConfig {
  name: string;
  platformName: string;
  founderCeo: string;
  mobile: string;
  mobileLink: string;
  configurableEmail: string;
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

export const COMPANY_CONFIG: CompanyConfig = {
  name: 'OPHIREUM MULTIMEDIA PRODUCTION',
  platformName: 'OPHIREUM NETWORK',
  founderCeo: 'Dhenze Languisan',
  mobile: '+63 917 966 8814',
  mobileLink: 'tel:+639179668814',
  configurableEmail: 'contact@ophireum.network',
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
