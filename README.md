# hr-onboarding

A **comprehensive HR onboarding system** built with Node.js, Express, and MSSQL. Streamline the employee onboarding process with checklists, document management, training scheduling, equipment tracking, and announcements — all in one place with role-based access for HR and employees.

---

## links

repository: https://github.com/sleepingeraser/hr-onboarding.git

koyuki's site: https://sleepingeraser.github.io/hr-onboarding/

koyuki's render: https://hr-onboarding-p9ib.onrender.com/index.html

---

## features

### frontend

- clean, modern UI with CSS variables and responsive design
- role-based dashboards (HR / Employee)
- interactive checklists with stage-based tasks (DAY1, WEEK1, MONTH1)
- document upload with status tracking
- training schedule view with attendance marking
- equipment management with acknowledgment workflow
- announcements and FAQ sections
- mobile-responsive layout

### authentication

- secure registration and login with bcrypt password hashing
- JWT token-based authentication
- role-based access control (HR and EMPLOYEE)
- protected routes with token validation
- automatic token expiration handling

### HR features

- document approval/rejection workflow with comments
- employee overview dashboard with progress tracking
- training session creation and management
- equipment inventory management
- equipment assignment and return tracking
- announcement creation and management
- FAQ management

### employee features

- personal onboarding checklist
- document upload and status tracking
- training schedule with attendance marking
- view assigned equipment with acknowledgment
- view announcements and FAQs
- progress dashboard with statistics

### database

- MSSQL database with connection pooling
- comprehensive schema with relationships
- automatic checklist initialization for new users
- training auto-assignment for all employees

---

## tech stack

### backend

- node.js: runtime environment
- express: web framework
- MSSQL: database
- JWT : authentication
- bcryptjs: password hashing
- multer: file upload handling
- cors: cross-origin resource sharing
- dotenv: environment variables

### frontend

- javascript: client-side logic
- html: structure
- css: styling with css variables
- fetch API: HTTP requests

### database

- microsoft SQL Server: database
  -SQL: stored procedures & queries

---

## prerequisites

- node.js
- microsoft SQL Server
- npm or yarn package manager
- git

---

## credits

### acknoedgements

- I received inspiration for this project from various HR management systems and onboarding platforms
