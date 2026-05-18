const axios = require('axios');

// Ganti dengan token yang valid dari localStorage browser Anda
const token = 'YOUR_VALID_TOKEN_HERE';

async function testStatisticsEndpoint() {
  try {
    const response = await axios.get('http://localhost:3000/api/statistics', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Statistics response:', response.data);
  } catch (error) {
    console.error('Error calling statistics endpoint:', error.response?.data || error.message);
  }
}

testStatisticsEndpoint();