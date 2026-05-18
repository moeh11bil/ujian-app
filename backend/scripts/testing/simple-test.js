const axios = require('axios');

async function testEndpoint() {
  try {
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'siswa@example.com',
      password: 'student123'
    });

    const token = loginResponse.data.token;
    console.log('Got token:', token.substring(0, 20) + '...');

    // Submit hasil
    const response = await axios.post('http://localhost:3000/api/hasil', {
      ujian_id: 4,
      jawaban_siswa: {
        "2": "A",
        "3": "B", 
        "4": "C"
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Success:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testEndpoint();