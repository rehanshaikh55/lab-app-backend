import https from 'https';

// You can use Google Maps Geocoding API or OpenStreetMap Nominatim
// For this example, I'll use a simple mock implementation
// Replace with your preferred geocoding service

const GEOCODING_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export const geocodeAddress = async (address) => {
  try {
    // Mock implementation - replace with actual API call
    if (!GEOCODING_API_KEY) {
      console.warn('Google Maps API key not provided, using mock data');
      return {
        coordinates: [77.5946, 12.9716], // Default to Bangalore
        address: address,
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560001',
        country: 'India'
      };
    }

    // Google Maps Geocoding API implementation
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`;
    
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'OK' && result.results.length > 0) {
              const location = result.results[0];
              const components = location.address_components;
              
              const locationData = {
                coordinates: [
                  location.geometry.location.lng,
                  location.geometry.location.lat
                ],
                address: location.formatted_address,
                city: getAddressComponent(components, 'locality') || 
                      getAddressComponent(components, 'administrative_area_level_2'),
                state: getAddressComponent(components, 'administrative_area_level_1'),
                zipCode: getAddressComponent(components, 'postal_code'),
                country: getAddressComponent(components, 'country') || 'India'
              };
              resolve(locationData);
            } else {
              reject(new Error('Address not found'));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  } catch (error) {
    throw new Error(`Geocoding failed: ${error.message}`);
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    if (!GEOCODING_API_KEY) {
      console.warn('Google Maps API key not provided, using mock data');
      return {
        coordinates: [longitude, latitude],
        address: `${latitude}, ${longitude}`,
        city: 'Unknown City',
        state: 'Unknown State',
        zipCode: '000000',
        country: 'India'
      };
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GEOCODING_API_KEY}`;
    
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'OK' && result.results.length > 0) {
              const location = result.results[0];
              const components = location.address_components;
              
              const locationData = {
                coordinates: [longitude, latitude],
                address: location.formatted_address,
                city: getAddressComponent(components, 'locality') || 
                      getAddressComponent(components, 'administrative_area_level_2'),
                state: getAddressComponent(components, 'administrative_area_level_1'),
                zipCode: getAddressComponent(components, 'postal_code'),
                country: getAddressComponent(components, 'country') || 'India'
              };
              resolve(locationData);
            } else {
              reject(new Error('Coordinates not found'));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  } catch (error) {
    throw new Error(`Reverse geocoding failed: ${error.message}`);
  }
};

// Helper function to extract address components
const getAddressComponent = (components, type) => {
  const component = components.find(c => c.types.includes(type));
  return component ? component.long_name : null;
};

// Calculate distance between two coordinates
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};
