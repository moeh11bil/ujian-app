const date = new Date();
console.log('Current server time:', date);
console.log('Current server time (ISO):', date.toISOString());
console.log('Current server time (UTC):', date.toUTCString());
console.log('Current server time (timestamp):', date.getTime());
console.log('Timezone offset (minutes):', date.getTimezoneOffset());
console.log('Timezone offset (hours):', date.getTimezoneOffset() / 60);