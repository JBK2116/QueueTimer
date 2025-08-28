# QueueTimer - Full-Stack Timer Application

A precision-focused task timing application with automatic timezone detection and multi-tab support. Built for users who need accurate, reliable time tracking without the hassle of registration or complex setup.

## 🌐 Live Application
**[queuetimer.live](https://queuetimer.live)**

## 📚 API Documentation
**[queuetimer.live/api/docs](https://queuetimer.live/api/docs)**

## ✨ Features

### Core Functionality
- **Zero Registration**: Start timing immediately - no sign-ups required
- **Single Page Application**: Fast, responsive React-based interface
- **Multi-Tab Support**: Run multiple timers simultaneously across browser tabs
- **Automatic Timezone Detection**: Uses IANA timezone detection with UTC storage for global accuracy
- **Daily Token System**: One token per day per browser for fair usage
- **Real-Time Accuracy**: Dynamic time calculations ensure precision regardless of pause timing

### Timer Features
- Simple task creation with title and duration input
- Automatic timer start upon creation
- Pause/resume functionality with accurate time tracking
- Audio alerts when timers reach completion
- Dynamic end time calculation for precise completion tracking

### Technical Highlights
- **Frontend**: HTML, CSS and vanilla JS
- **Backend**: FastAPI with 13 RESTful endpoints
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Migrations**: Alembic for database version control
- **Deployment**: AWS EC2 with Uvicorn server and Nginx reverse proxy
- **Documentation**: Auto-generated Swagger/OpenAPI documentation

## 🚀 Architecture

### Backend Stack
- **FastAPI**: High-performance Python web framework
- **PostgreSQL**: Robust relational database
- **SQLAlchemy**: Python ORM for database operations
- **Alembic**: Database migration management
- **Uvicorn**: Lightning-fast ASGI server

### Infrastructure
- **AWS EC2**: Cloud hosting
- **Nginx**: Reverse proxy and load balancing
- **Auto-generated API docs**: Interactive Swagger interface

## 🔧 Key Technical Features

### Time Management
- IANA timezone detection ensures local accuracy
- UTC storage prevents timezone-related calculation errors
- Dynamic pause counting maintains precision
- Real-time end time calculations

### Session Management
- Token-based authentication without user accounts
- Daily token refresh system
- Browser-based session persistence
- Multi-tab session synchronization

## 🎯 Use Cases
- **Students**: Track study sessions and assignment work
- **Professionals**: Time block work tasks and meetings
- **Freelancers**: Monitor billable hours across projects
- **Anyone**: Simple, distraction-free task timing

## 🌟 Why QueueTimer?
- **No barriers to entry** - start timing in seconds
- **Completely free** - no premium features or paywalls
- **Privacy-focused** - no personal data collection
- **Reliable accuracy** - precision timing you can trust
- **Multi-device friendly** - works across all your devices
