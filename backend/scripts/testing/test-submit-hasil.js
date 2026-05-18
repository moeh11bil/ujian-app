const axios = require('axios');

// This is a test script to simulate the request that's failing
async function testSubmitHasil() {
  try {
    // This token should be replaced with a valid token from your system
    const token = 'YOUR_VALID_TOKEN_HERE'; // This needs to be a real token from your system

    const requestBody = {
      ujian_id: 4, // Based on the log showing examId 4
      jawaban_siswa: {
        "2": "A",
        "3": "B",
        "4": "C"
      }
    };

    console.log('Testing POST /api/hasil with body:', requestBody);

    const response = await axios.post('http://localhost:3000/api/hasil', requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Success response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error response status:', error.response.status);
      console.log('Error response data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Function to get a token by logging in
async function getToken(email, password) {
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email,
      password
    });

    console.log('Login successful, token:', response.data.token);
    return response.data.token;
  } catch (error) {
    console.log('Login failed:', error.response?.data || error.message);
    return null;
  }
}

// Example usage:
// 1. First get a token by logging in
// 2. Then use that token to test the /api/hasil endpoint

async function runTest() {
  // Replace with actual test user credentials from create-test-users.js
  const email = 'siswa@example.com';
  const password = 'student123';

  const token = await getToken(email, password);
  if (token) {
    console.log('Using token:', token.substring(0, 20) + '...');

    const requestBody = {
      ujian_id: 4, // Based on the log showing examId 4
      jawaban_siswa: {
        "2": "A",
        "3": "B",
        "4": "C"
      }
    };

    console.log('Testing POST /api/hasil with body:', requestBody);

    try {
      const response = await axios.post('http://localhost:3000/api/hasil', requestBody, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Success response:', response.data);
    } catch (error) {
      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response data:', error.response.data);
      } else {
        console.log('Error:', error.message);
      }
    }
  }
}

runTest();