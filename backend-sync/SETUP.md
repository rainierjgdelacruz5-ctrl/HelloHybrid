# Customer login with Gmail OTP: setup

1. In `backend-sync/`: `npm install nodemailer dotenv`
2. Create a Google App password for the Gmail that will SEND the codes
   (Google Account > Security > 2-Step Verification > App passwords).
3. Create `backend-sync/.env`:
   GMAIL_USER=yourshop@gmail.com
   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
4. `npm start`, then open http://localhost:3000/login.html

Without step 3 the code is printed in the server console instead (development only).
Files: backend-sync/server.js, customer-portal/script.js, customer-portal/login.html (new).
