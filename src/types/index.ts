export interface Passenger {
  id: string;
  fullName: string;
  nationality: string;
  passportNumber: string;
  contactNumber: string;
  // Documents (stored as base64)
  civilIdFile?: string;
  civilIdFileName?: string;
  civilIdFile2?: string;        // Optional second page of Civil ID
  civilIdFileName2?: string;
  passportFile?: string;
  passportFileName?: string;
  photoFile?: string;
  photoFileName?: string;
  // Visa status
  hasVisa?: boolean;            // Passenger already has a Saudi visa
  visaFile?: string;            // Visa copy (if hasVisa)
  visaFileName?: string;
}

export interface FormData {
  id: string;
  submissionDate: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'completed';
  
  // Travel Type
  travelType: 'individual' | 'family' | 'group';
  
  // Group/Family Info (only if travelType is family or group)
  groupContactName?: string;
  groupContactNumber?: string;
  numberOfPassengers?: number;
  
  // Passenger Details
  passengers: Passenger[];
  
  // Transit Info
  transitAirport: 'DMM' | 'RUH' | 'MED' | 'JED' | 'GIZ' | '';
  
  // Destination Info
  destinationAirportCode: string;
  customDestinationAirport?: string; // For when 'OTHER' is selected
  
  // Land Transportation
  needsLandTransport: boolean;
  
  // Documents (stored as base64)
  civilIdFile?: string;
  civilIdFileName?: string;
  passportFile?: string;
  passportFileName?: string;
  photoFile?: string;
  photoFileName?: string;
}

export const AIRPORT_OPTIONS = [
  { code: 'DMM', name: 'Dammam (DMM)', flightNumbers: 'ET422/ET423' },
  { code: 'RUH', name: 'Riyadh (RUH)', flightNumbers: 'ET412/ET413' },
  { code: 'MED', name: 'Medina (MED)', flightNumbers: 'ET442/ET443' },
  { code: 'JED', name: 'Jeddah (JED)', flightNumbers: 'ET402/ET403' },
  { code: 'GIZ', name: 'Jizan (GIZ)', flightNumbers: 'ET446/ET447' },
] as const;

export const AFRICAN_NATIONALITIES = [
  'Ethiopian',
  'Nigerian',
  'Ghanaian',
  'Beninese',
  'Kenyan',
  'Ugandan',
  'Tanzanian',
  'Rwandan',
  'Burundian',
  'South Sudanese',
  'Sudanese',
  'Egyptian',
  'Libyan',
  'Tunisian',
  'Algerian',
  'Moroccan',
  'Senegalese',
  'Mali',
  'Burkina Faso',
  'Ivorian',
  'Guinean',
  'Sierra Leonean',
  'Liberian',
  'Gambian',
  'Mauritanian',
  'Nigerien',
  'Chadian',
  'Cameroonian',
  'Central African',
  'Equatorial Guinean',
  'Gabonese',
  'Congolese (DRC)',
  'Congolese (Republic)',
  'Angolan',
  'Zambian',
  'Malawian',
  'Mozambican',
  'Zimbabwean',
  'Botswanan',
  'Namibian',
  'South African',
  'Swazi',
  'Lesotho',
  'Madagascan',
  'Mauritian',
  'Seychellois',
  'Comoran',
  'Sao Tomean',
  'Cape Verdean',
  'Djiboutian',
  'Eritrean',
  'Somali',
] as const;

export const OTHER_NATIONALITIES = [
  'Kuwaiti',
  'Saudi Arabian',
  'Emirati',
  'Qatari',
  'Bahraini',
  'Omani',
  'Jordanian',
  'Lebanese',
  'Syrian',
  'Iraqi',
  'Iranian',
  'Pakistani',
  'Indian',
  'Bangladeshi',
  'Sri Lankan',
  'Nepali',
  'Afghan',
  'Turkish',
  'Other',
] as const;

export const ALL_NATIONALITIES = [...AFRICAN_NATIONALITIES, ...OTHER_NATIONALITIES];

export const WHATSAPP_NUMBER = '+96594767191';

// Common destination airports for Ethiopian Airlines passengers
export const DESTINATION_AIRPORTS = [
  // Kuwait
  { code: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait' },
  
  // Ethiopia
  { code: 'ADD', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'Ethiopia' },
  { code: 'DIR', name: 'Dire Dawa International Airport', city: 'Dire Dawa', country: 'Ethiopia' },
  { code: 'BJR', name: 'Bahir Dar Airport', city: 'Bahir Dar', country: 'Ethiopia' },
  { code: 'GMB', name: 'Gambela Airport', city: 'Gambela', country: 'Ethiopia' },
  
  // Nigeria
  { code: 'LOS', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria' },
  { code: 'ABV', name: 'Nnamdi Azikiwe International Airport', city: 'Abuja', country: 'Nigeria' },
  { code: 'KAN', name: 'Mallam Aminu Kano International Airport', city: 'Kano', country: 'Nigeria' },
  
  // Ghana
  { code: 'ACC', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana' },
  
  // Kenya
  { code: 'NBO', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'Kenya' },
  { code: 'MBA', name: 'Moi International Airport', city: 'Mombasa', country: 'Kenya' },
  
  // Uganda
  { code: 'EBB', name: 'Entebbe International Airport', city: 'Entebbe', country: 'Uganda' },
  
  // Tanzania
  { code: 'DAR', name: 'Julius Nyerere International Airport', city: 'Dar es Salaam', country: 'Tanzania' },
  { code: 'JRO', name: 'Kilimanjaro International Airport', city: 'Kilimanjaro', country: 'Tanzania' },
  
  // Rwanda
  { code: 'KGL', name: 'Kigali International Airport', city: 'Kigali', country: 'Rwanda' },
  
  // Sudan
  { code: 'KRT', name: 'Khartoum International Airport', city: 'Khartoum', country: 'Sudan' },
  
  // Egypt
  { code: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt' },
  
  // South Africa
  { code: 'JNB', name: 'O.R. Tambo International Airport', city: 'Johannesburg', country: 'South Africa' },
  { code: 'CPT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'South Africa' },
  
  // Cameroon
  { code: 'DLA', name: 'Douala International Airport', city: 'Douala', country: 'Cameroon' },
  
  // DRC
  { code: 'FIH', name: 'N\'djili Airport', city: 'Kinshasa', country: 'DR Congo' },
  
  // Zambia
  { code: 'LUN', name: 'Kenneth Kaunda International Airport', city: 'Lusaka', country: 'Zambia' },
  
  // Zimbabwe
  { code: 'HRE', name: 'Robert Gabriel Mugabe International Airport', city: 'Harare', country: 'Zimbabwe' },
  
  // Other African Countries
  { code: 'BJL', name: 'Banjul International Airport', city: 'Banjul', country: 'Gambia' },
  { code: 'OXB', name: 'Osvaldo Vieira International Airport', city: 'Bissau', country: 'Guinea-Bissau' },
  { code: 'FNA', name: 'Lungi International Airport', city: 'Freetown', country: 'Sierra Leone' },
  { code: 'ROB', name: 'Roberts International Airport', city: 'Monrovia', country: 'Liberia' },
  { code: 'CKY', name: 'Conakry International Airport', city: 'Conakry', country: 'Guinea' },
  { code: 'ABJ', name: 'Félix-Houphouët-Boigny International Airport', city: 'Abidjan', country: 'Ivory Coast' },
  { code: 'OUA', name: 'Ouagadougou Airport', city: 'Ouagadougou', country: 'Burkina Faso' },
  { code: 'LFW', name: 'Lomé–Tokoin International Airport', city: 'Lomé', country: 'Togo' },
  { code: 'COO', name: 'Cadjehoun Airport', city: 'Cotonou', country: 'Benin' },
  { code: 'NDJ', name: 'N\'Djamena International Airport', city: 'N\'Djamena', country: 'Chad' },
  { code: 'BGF', name: 'Bangui M\'Poko International Airport', city: 'Bangui', country: 'Central African Republic' },
  { code: 'SSG', name: 'Malabo International Airport', city: 'Malabo', country: 'Equatorial Guinea' },
  { code: 'LBV', name: 'Léon-Mba International Airport', city: 'Libreville', country: 'Gabon' },
  { code: 'BZV', name: 'Maya-Maya Airport', city: 'Brazzaville', country: 'Congo' },
  { code: 'MPM', name: 'Maputo International Airport', city: 'Maputo', country: 'Mozambique' },
  { code: 'BLZ', name: 'Chileka International Airport', city: 'Blantyre', country: 'Malawi' },
  { code: 'WDH', name: 'Hosea Kutako International Airport', city: 'Windhoek', country: 'Namibia' },
  { code: 'GBE', name: 'Sir Seretse Khama International Airport', city: 'Gaborone', country: 'Botswana' },
  { code: 'MSU', name: 'Moshoeshoe I International Airport', city: 'Maseru', country: 'Lesotho' },
  { code: 'MRU', name: 'Sir Seewoosagur Ramgoolam International Airport', city: 'Port Louis', country: 'Mauritius' },
  { code: 'SEZ', name: 'Seychelles International Airport', city: 'Mahé', country: 'Seychelles' },
  { code: 'HAH', name: 'Prince Said Ibrahim International Airport', city: 'Moroni', country: 'Comoros' },
  { code: 'TNR', name: 'Ivato International Airport', city: 'Antananarivo', country: 'Madagascar' },
  
  // Middle East
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE' },
  { code: 'AUH', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'UAE' },
  { code: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar' },
  { code: 'BAH', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain' },
  { code: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman' },
  { code: 'AMM', name: 'Queen Alia International Airport', city: 'Amman', country: 'Jordan' },
  { code: 'BEY', name: 'Beirut-Rafic Hariri International Airport', city: 'Beirut', country: 'Lebanon' },
  { code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey' },
  
  // Asia
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India' },
  { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India' },
  { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India' },
  { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bangalore', country: 'India' },
  { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India' },
  { code: 'COK', name: 'Cochin International Airport', city: 'Kochi', country: 'India' },
  { code: 'TRV', name: 'Trivandrum International Airport', city: 'Thiruvananthapuram', country: 'India' },
  { code: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', country: 'India' },
  { code: 'KHI', name: 'Jinnah International Airport', city: 'Karachi', country: 'Pakistan' },
  { code: 'LHE', name: 'Allama Iqbal International Airport', city: 'Lahore', country: 'Pakistan' },
  { code: 'ISB', name: 'Islamabad International Airport', city: 'Islamabad', country: 'Pakistan' },
  { code: 'DAC', name: 'Hazrat Shahjalal International Airport', city: 'Dhaka', country: 'Bangladesh' },
  { code: 'CMB', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka' },
  { code: 'KTM', name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal' },
  { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand' },
  { code: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia' },
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
  { code: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia' },
  { code: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines' },
  { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong' },
  { code: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China' },
  { code: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China' },
  { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea' },
  { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan' },
  { code: 'HND', name: 'Haneda Airport', city: 'Tokyo', country: 'Japan' },
  
  // Europe
  { code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'UK' },
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
  { code: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands' },
  { code: 'FCO', name: 'Leonardo da Vinci–Fiumicino Airport', city: 'Rome', country: 'Italy' },
  { code: 'MAD', name: 'Adolfo Suárez Madrid–Barajas Airport', city: 'Madrid', country: 'Spain' },
  { code: 'BCN', name: 'Barcelona–El Prat Airport', city: 'Barcelona', country: 'Spain' },
  { code: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland' },
  { code: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria' },
  { code: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium' },
  { code: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark' },
  { code: 'ARN', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden' },
  { code: 'OSL', name: 'Oslo Airport', city: 'Oslo', country: 'Norway' },
  { code: 'HEL', name: 'Helsinki Airport', city: 'Helsinki', country: 'Finland' },
  { code: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland' },
  { code: 'PRG', name: 'Václav Havel Airport Prague', city: 'Prague', country: 'Czech Republic' },
  { code: 'WAW', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland' },
  { code: 'BUD', name: 'Budapest Ferenc Liszt International Airport', city: 'Budapest', country: 'Hungary' },
  { code: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'Greece' },
  { code: 'LIS', name: 'Humberto Delgado Airport', city: 'Lisbon', country: 'Portugal' },
  { code: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany' },
  { code: 'MXP', name: 'Milan Malpensa Airport', city: 'Milan', country: 'Italy' },
  { code: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland' },
  
  // North America
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'USA' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'USA' },
  { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', country: 'USA' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'USA' },
  { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', country: 'USA' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'USA' },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'USA' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'USA' },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'USA' },
  { code: 'BOS', name: 'Logan International Airport', city: 'Boston', country: 'USA' },
  { code: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada' },
  { code: 'YUL', name: 'Montréal-Pierre Elliott Trudeau International Airport', city: 'Montreal', country: 'Canada' },
  { code: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada' },
  
  // South America
  { code: 'GRU', name: 'São Paulo/Guarulhos International Airport', city: 'São Paulo', country: 'Brazil' },
  { code: 'GIG', name: 'Rio de Janeiro/Galeão International Airport', city: 'Rio de Janeiro', country: 'Brazil' },
  { code: 'EZE', name: 'Ministro Pistarini International Airport', city: 'Buenos Aires', country: 'Argentina' },
  { code: 'SCL', name: 'Arturo Merino Benítez International Airport', city: 'Santiago', country: 'Chile' },
  { code: 'BOG', name: 'El Dorado International Airport', city: 'Bogotá', country: 'Colombia' },
  { code: 'LIM', name: 'Jorge Chávez International Airport', city: 'Lima', country: 'Peru' },
  
  // Australia/Oceania
  { code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia' },
  { code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia' },
  { code: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia' },
  { code: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia' },
  { code: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand' },
  
  // Other (Custom entry)
  { code: 'OTHER', name: 'Other (Enter manually)', city: 'Other', country: 'Other' },
] as const;
