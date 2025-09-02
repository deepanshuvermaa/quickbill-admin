# QuickBill Admin Panel

A web-based admin panel for QuickBill with integrated ParkEase Manager functionality.

## Features

- **QuickBill Management**: Manage payments, subscriptions, and user accounts
- **ParkEase Integration**: Complete parking management system with real-time monitoring
- **Single-Device Enforcement**: Automatic logout on multi-device access
- **Real-time Stats**: Live dashboard with system statistics
- **User Session Management**: Monitor and control active user sessions

## Setup

1. Open `index.html` in a web browser
2. Login with admin credentials
3. Access all features through the tabbed interface

## Configuration

- QuickBill API: Configured in `app.js`
- ParkEase API: Configured in `js/config.js`
- Backend: Railway deployment at `https://parkease-backend-production.up.railway.app`

## Deployment

This is a static web application that can be hosted on GitHub Pages, Netlify, or any static hosting service.

## Admin Access

- Email: `deepanshuverma966@gmail.com`
- Role: Admin privileges required for access

## Architecture

- **Frontend**: Vanilla JavaScript with Tailwind CSS
- **Backend**: Node.js with PostgreSQL
- **Authentication**: JWT tokens with refresh mechanism
- **Real-time**: WebSocket connections for live updates