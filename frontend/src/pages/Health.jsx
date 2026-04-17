// src/pages/Health.jsx
import React from 'react';

function Health() {
  const ts = new Date().toISOString();

 return (
  <pre>{JSON.stringify({ status: 'OK', timestamp: ts }, null, 2)}</pre>
);
}

export default Health;