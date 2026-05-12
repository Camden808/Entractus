# Overview

We’re building a Recruitment Website to display information for employee recruiting services. Businesses looking for employees can fill out a form to request recruiter service consultation. Employees can search for job posts on a gallery list for open positions. Business users can access a portal with a link from the site navigation to retrieve or view their account information. This site will provide an overview of the recruiting services for different industries with a focus on the Construction and Engineering industry.

The site needs to be user friendly and have a welcoming landing page that enhances the company recruitment service offerings. The site will use global navigation for each page on the site.

# Tech Stack

* **Frontend**: React with TypeScript, Tailwind CSS
* **Backend**: Node.js + Express
* **Database**: PostgreSQL with Prisma ORM
* **Auth**: JWT with refresh tokens
* **Hosting**: TBD (Vercel, Railway or Render)

# Users

* id (UUID)
* email (unique)
* company
* password\_hash
* display\_name
* timezone (default: UTC)
* created\_at

# Company Information

* id (UUID)
* firstName
* lastName
* company
* addressLine1
* addressLine2
* city
* state
* phone
* email
* positionName
* positionTitle
* positionType
* duties
* referralSource
* questions

# Industry

* Industry
  + id (UUID)
  + user\_id (nullable – null means system default)
  + client (Boolean – yes/no)

# Authentication

* Register with email/password
* Login/logout
* Password reset via email
* Edit profile (name, timezone)
* Delete account (removes all data)

# Screens

## Main

The main screen shows when a user visits the .com page

* Contains Navigation to all pages
  + Hire Employees button
  + Job Openings Button
  + Email us Button
  + Phone us Button
* Drop Down Menu
  + For Employers
  + For Job Seekers
  + About
  + Blog
  + Contact Us
* Main Content Area with the following Information
  + Catchy Banner business image and links to job postings page

## Employers Page

The Employers Page contains a Contact US Today Button with the following information:

Recruitment Service Request

Entractus Recruitment is one of the leading placement Engineering and Construction industry. We provide a variety of recruitment solutions designed to meet our clients’ needs, including temp, temp to hire and permanent placement. Whether you’re attempting to fill a permanent role, cover an employee on leave or you simply need some extra help for a couple of days, we are eager to serve.

Clients utilize our recruitment services for a variety of reasons:

* Staffing a project that is time-sensitive while saving on costs
* Finding the perfect candidate for a permanent position
* Covering for employees on vacation or medical leave
* Allowing candidates to try the job out before accepting an offer

## Contact Page

Contact Form Page contains the following form:

**EMPLOYERS:**

If you are hiring, please complete the form below, and someone from the Entractus Recruitment team will be in touch.

|  |
| --- |
| Company Information: |
| Contact Name \* |
|  |
| First |
|  |
| Last |
|  |
| Company Name \* |
|  |
| Company Address \* |
|  |
| Address Line 1 |
|  |
| City |
|  |
| Phone \* |
|  |
| Email \* |
|  |

What position(s) are you hiring for?

|  |
| --- |
| Position Title: |
|  |
| Position Type: |
| Temporary, Temp To Perm, Direct Hire |
| Hours |
| Full Time, Part Time |
| Position Duties & Responsibilities |
|  |

If you have a job description, please attach it here.

Drag & Drop Files, Choose Files to Upload

|  |
| --- |
| Do you have any additional questions regarding hiring talent through Entractus Recruitment? |
|  |

## Job Openings

Job Openings contains the following text below on the content portion of the web page and a searchable and filterable gallery control below the information text.

Whether you’re looking for a permanent or temporary job, please look at our job board below for the variety of positions our agency offers. If you find an opening that seems like a good match for your skills and experience, please feel free to apply for the position directly from the listing.

The Job Seekers Page contains all job postings, is searchable, and has page job filters.

All Job Listings should have the following fields in a gallery format connected to the Job Listing database:

* Job Title
* State, City
* Type
* Company
* Posted Date

## API Endpoints

Auth

* POST /api/auth/register
* POST /api/auth/login
* POST /api/auth/refresh
* POST /api/auth/logout
* POST /api/auth/forgot-password
* POST /api/auth/reset-password

User

* GET /api/users/me
* PATCH /api/users/me
* DELETE /api/users/me

Postings

* POST /api/employer/request
* POST /api/employer/post
* POST /api/employer/delete
* POST /api/employer/signup