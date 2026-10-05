// Páginas por zona (/zonas/<id>/). Textos en ES/EN/PT.
// "match": nombres de zona/barrio de las propiedades que se muestran en esa página.
export const ZONAS = [
  {
    id: 'miami', name: 'Miami',
    match: ['Miami', 'Miami Beach', 'South Beach', 'Mid-Beach', 'North Beach', 'Brickell', 'Downtown', 'Brickell / Downtown', 'Edgewater', 'Coral Gables', 'Coconut Grove', 'Coral Gables / Coconut Grove', 'Key Biscayne', 'North Miami', 'Bal Harbour', 'Sunny Isles', 'Fisher Island', 'Star Island'],
    title: {
      es: 'Concierge de lujo y alquiler de residencias en Miami | MAIARC',
      en: 'Luxury concierge & villa rentals in Miami | MAIARC',
      pt: 'Concierge de luxo e aluguel de residências em Miami | MAIARC',
    },
    h1: { es: 'Miami', en: 'Miami', pt: 'Miami' },
    intro: {
      es: 'Residencias exclusivas en alquiler y venta en Miami, de Miami Beach a Brickell, Coral Gables y Key Biscayne. Seleccionamos cada propiedad y completamos la estadía con concierge privado: chef, yates, traslados, eventos y reservas en los mejores lugares de la ciudad.',
      en: 'Exceptional homes to rent and buy across Miami, from Miami Beach to Brickell, Coral Gables and Key Biscayne. Every residence is hand-selected, and every stay comes with private concierge: chefs, yachts, chauffeurs, events and tables at the city’s best addresses.',
      pt: 'Residências exclusivas para alugar e comprar em Miami, de Miami Beach a Brickell, Coral Gables e Key Biscayne. Selecionamos cada imóvel e completamos a estadia com concierge privado: chef, iates, transfers, eventos e reservas nos melhores endereços da cidade.',
    },
  },
  {
    id: 'miami-beach', name: 'Miami Beach',
    match: ['Miami Beach', 'South Beach', 'Mid-Beach', 'North Beach', 'Star Island', 'Fisher Island'],
    title: {
      es: 'Alquiler de residencias de lujo en Miami Beach | MAIARC',
      en: 'Luxury home rentals in Miami Beach | MAIARC',
      pt: 'Aluguel de residências de luxo em Miami Beach | MAIARC',
    },
    h1: { es: 'Miami Beach', en: 'Miami Beach', pt: 'Miami Beach' },
    intro: {
      es: 'Residencias frente al mar y sobre la bahía en Miami Beach, de South Beach a Mid-Beach. Muchas de nuestras propiedades en la zona se comparten de forma privada: contanos qué buscás y te enviamos opciones a medida, con todo el concierge para tu estadía.',
      en: 'Oceanfront and bayfront residences in Miami Beach, from South Beach to Mid-Beach. Many of our homes here are shared privately — tell us what you have in mind and we’ll send a tailored selection, with full concierge for your stay.',
      pt: 'Residências de frente para o mar e para a baía em Miami Beach, de South Beach a Mid-Beach. Muitos dos nossos imóveis na região são compartilhados em particular: conte o que procura e enviamos opções sob medida, com todo o concierge para sua estadia.',
    },
  },
  {
    id: 'brickell', name: 'Brickell',
    match: ['Brickell', 'Downtown', 'Brickell / Downtown', 'Edgewater'],
    title: {
      es: 'Departamentos y penthouses de lujo en Brickell y Downtown Miami | MAIARC',
      en: 'Luxury condos & penthouses in Brickell and Downtown Miami | MAIARC',
      pt: 'Apartamentos e coberturas de luxo em Brickell e Downtown Miami | MAIARC',
    },
    h1: { es: 'Brickell y Downtown', en: 'Brickell & Downtown', pt: 'Brickell e Downtown' },
    intro: {
      es: 'Departamentos y penthouses en Brickell y Downtown, con vistas a la bahía y la ciudad a pocos pasos. Contanos qué buscás y te enviamos opciones a medida, públicas y privadas, con concierge durante toda tu estadía.',
      en: 'Condos and penthouses in Brickell and Downtown, with bay views and the city on your doorstep. Tell us what you’re looking for and we’ll send a tailored selection — listed and private — with concierge throughout your stay.',
      pt: 'Apartamentos e coberturas em Brickell e Downtown, com vista para a baía e a cidade a poucos passos. Conte o que procura e enviamos opções sob medida, públicas e privadas, com concierge durante toda a estadia.',
    },
  },
  {
    id: 'coral-gables', name: 'Coral Gables',
    match: ['Coral Gables', 'Coconut Grove', 'Coral Gables / Coconut Grove'],
    title: {
      es: 'Residencias de lujo en Coral Gables y Coconut Grove | MAIARC',
      en: 'Luxury homes in Coral Gables & Coconut Grove | MAIARC',
      pt: 'Residências de luxo em Coral Gables e Coconut Grove | MAIARC',
    },
    h1: { es: 'Coral Gables y Coconut Grove', en: 'Coral Gables & Coconut Grove', pt: 'Coral Gables e Coconut Grove' },
    intro: {
      es: 'Villas entre jardines tropicales y casas sobre el agua en Coral Gables y Coconut Grove, los barrios más verdes y tranquilos de Miami. Te acercamos opciones a medida, públicas y privadas, con todo el concierge para tu estadía.',
      en: 'Villas set in tropical gardens and waterfront homes in Coral Gables and Coconut Grove, Miami’s greenest, most tranquil neighborhoods. We’ll curate options for you — listed and private — with full concierge for your stay.',
      pt: 'Villas entre jardins tropicais e casas à beira d’água em Coral Gables e Coconut Grove, os bairros mais verdes e tranquilos de Miami. Enviamos opções sob medida, públicas e privadas, com todo o concierge para sua estadia.',
    },
  },
  {
    id: 'key-biscayne', name: 'Key Biscayne',
    match: ['Key Biscayne'],
    title: {
      es: 'Alquiler de residencias de lujo en Key Biscayne | MAIARC',
      en: 'Luxury home rentals in Key Biscayne | MAIARC',
      pt: 'Aluguel de residências de luxo em Key Biscayne | MAIARC',
    },
    h1: { es: 'Key Biscayne', en: 'Key Biscayne', pt: 'Key Biscayne' },
    intro: {
      es: 'Casas y residencias frente al mar en Key Biscayne, una isla tranquila a minutos de Brickell. Contanos qué buscás y te enviamos opciones a medida, con concierge durante toda tu estadía.',
      en: 'Beachfront homes and residences on Key Biscayne, a quiet island minutes from Brickell. Tell us what you have in mind and we’ll send a tailored selection, with concierge throughout your stay.',
      pt: 'Casas e residências de frente para o mar em Key Biscayne, uma ilha tranquila a minutos de Brickell. Conte o que procura e enviamos opções sob medida, com concierge durante toda a estadia.',
    },
  },
  {
    id: 'north-miami', name: 'North Miami',
    match: ['North Miami', 'Bal Harbour', 'Sunny Isles', 'North Beach'],
    title: {
      es: 'Residencias de lujo en North Miami, Bal Harbour y Sunny Isles | MAIARC',
      en: 'Luxury homes in North Miami, Bal Harbour & Sunny Isles | MAIARC',
      pt: 'Residências de luxo em North Miami, Bal Harbour e Sunny Isles | MAIARC',
    },
    h1: { es: 'North Miami', en: 'North Miami', pt: 'North Miami' },
    intro: {
      es: 'Residencias sobre el agua y frente al mar en North Miami, Bal Harbour y Sunny Isles. Te acercamos opciones a medida, públicas y privadas, con todo el concierge para tu estadía.',
      en: 'Waterfront and oceanfront residences in North Miami, Bal Harbour and Sunny Isles. We’ll curate options for you — listed and private — with full concierge for your stay.',
      pt: 'Residências à beira d’água e de frente para o mar em North Miami, Bal Harbour e Sunny Isles. Enviamos opções sob medida, públicas e privadas, com todo o concierge para sua estadia.',
    },
  },
  {
    id: 'fort-lauderdale', name: 'Fort Lauderdale',
    match: ['Fort Lauderdale', 'FORT LAUDERDALE', 'FORT LAUDARDALE', 'Fort Laudardale'],
    title: {
      es: 'Residencias de lujo sobre el agua en Fort Lauderdale | MAIARC',
      en: 'Luxury waterfront homes in Fort Lauderdale | MAIARC',
      pt: 'Residências de luxo à beira d’água em Fort Lauderdale | MAIARC',
    },
    h1: { es: 'Fort Lauderdale', en: 'Fort Lauderdale', pt: 'Fort Lauderdale' },
    intro: {
      es: 'Casas sobre los canales de Fort Lauderdale, con muelle propio y salida directa al mar, a menos de una hora de Miami. Contanos qué buscás y te enviamos opciones a medida, con concierge durante toda tu estadía.',
      en: 'Homes on the canals of Fort Lauderdale, with private docks and direct ocean access, under an hour from Miami. Tell us what you have in mind and we’ll send a tailored selection, with concierge throughout your stay.',
      pt: 'Casas nos canais de Fort Lauderdale, com píer próprio e saída direta para o mar, a menos de uma hora de Miami. Conte o que procura e enviamos opções sob medida, com concierge durante toda a estadia.',
    },
  },
];
