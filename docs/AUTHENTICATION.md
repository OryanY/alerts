# Authentication Guide 🔐

## Overview
This project uses **Windows Authentication (NTLM)** managed by IIS/node-sspi.
We have standardized how authentication is handled to make it easy to use for everyone.

## Frontend Usage (React)

### Getting Current User
Use the `useUser` hook to access user information anywhere in the app.

```javascript
import { useUser } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user, loading, isAdmin } = useUser();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Hello, {user.displayName}!</h1>
      {isAdmin && <button>Delete Everything</button>}
    </div>
  );
};
```

### User Object Structure
```javascript
{
  username: "oyitzhaki",
  domain: "ORYAN",
  fullName: "Oryan Yitzhaki",
  displayName: "Oryan Yitzhaki",
  initials: "OY",
  groups: ["Admins", "Users"],
  isAuthenticated: true,
  isAdmin: true // Helper property provided by hook
}
```

## Backend Usage (Node.js)

### Protecting a Route
Simply add the `requireRole` middleware to your route.

```javascript
const { requireRole } = require('../middleware/auth');

// Protect a single route (Requires 'Admins' group)
router.post('/delete-db', requireRole('Admins'), controller.deleteDb);

// Protect a whole router
const protectedRouter = express.Router();
protectedRouter.use(requireRole('Admins', 'IT-Support'));

protectedRouter.get('/secrets', ...);
app.use('/api/secrets', protectedRouter);
```

### Checking User in Controller
The `req.user` object is automatically populated if the user is authenticated.

```javascript
const myController = (req, res) => {
  const user = req.user;
  console.log(`Action performed by ${user.fullName}`);
};
```

## Environment & Logs

### Production (`NODE_ENV=production`)
- **Logs**: Only errors (status >= 400) are logged.

### Development (`NODE_ENV=development`)
- **Logs**: All requests are logged.
- **Bypass**: If `AUTH_DEV_BYPASS=true` in `.env`, you will be automatically logged in as a fake Admin user for testing.
