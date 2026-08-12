export const STUDIO = {
  name: 'REFORGE',
  venue: 'City Box Gym',
  street: 'Augoustas Theodoras 9',
  city: 'Limassol',
  region: 'Lemesos',
  postal: '3035',
  country: 'Cyprus',
  phoneDisplay: '+357 99 860056',
  phoneE164: '+35799860056',
  owner: 'Andreas Petrides',
  mapsQuery: 'City Box Gym, Augoustas Theodoras 9, Limassol 3035, Cyprus',
} as const;

export function studioAddressLines() {
  return [
    STUDIO.venue,
    STUDIO.street,
    `${STUDIO.city}, ${STUDIO.region} ${STUDIO.postal}`,
    STUDIO.country,
  ];
}
