-- CREATE DATABASE HROnboardingDB

USE HROnboardingDB
GO

-- Drop existing tables if they exist
DROP TABLE IF EXISTS UserTraining
DROP TABLE IF EXISTS Trainings
DROP TABLE IF EXISTS Documents
DROP TABLE IF EXISTS UserChecklist
DROP TABLE IF EXISTS ChecklistItems
DROP TABLE IF EXISTS User

-- users table
CREATE TABLE Users (
  UserId INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL,
  Email NVARCHAR(200) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(200) NOT NULL,
  Role NVARCHAR(20) NOT NULL CHECK (Role IN ('HR','EMPLOYEE')),
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
)

-- checklist items table
CREATE TABLE ChecklistItems (
  ItemId INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  Stage NVARCHAR(20) NOT NULL CHECK (Stage IN ('DAY1','WEEK1','MONTH1')),
  Description NVARCHAR(500) NULL,
  IsActive BIT NOT NULL DEFAULT 1
)

-- user checklist table
CREATE TABLE UserChecklist (
  UserId INT NOT NULL,
  ItemId INT NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING','DONE')),
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  PRIMARY KEY (UserId, ItemId),
  FOREIGN KEY (UserId) REFERENCES Users(UserId),
  FOREIGN KEY (ItemId) REFERENCES ChecklistItems(ItemId)
)

-- document table
CREATE TABLE Documents (
  DocId INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  DocType NVARCHAR(50) NOT NULL,
  FileUrl NVARCHAR(300) NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING','APPROVED','REJECTED')),
  HRComment NVARCHAR(300) NULL,
  UploadedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (UserId) REFERENCES Users(UserId)
)

--trainings table
CREATE TABLE Trainings (
  TrainingId INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  StartsAt DATETIME2 NOT NULL,
  Location NVARCHAR(200) NULL,
  Notes NVARCHAR(500) NULL
)

-- user training table
CREATE TABLE UserTraining (
  UserId INT NOT NULL,
  TrainingId INT NOT NULL,
  Attendance NVARCHAR(20) NOT NULL DEFAULT 'UPCOMING' CHECK (Attendance IN ('UPCOMING','ATTENDED')),
  PRIMARY KEY (UserId, TrainingId),
  FOREIGN KEY (UserId) REFERENCES Users(UserId),
  FOREIGN KEY (TrainingId) REFERENCES Trainings(TrainingId)
)

-- insert sample data
INSERT INTO ChecklistItems (Title, Stage, Description) VALUES
('Read company policies', 'DAY1', 'Review handbook + code of conduct'),
('Attend safety briefing', 'DAY1', '10:00 AM session'),
('Sign employment contract', 'WEEK1', 'Upload signed contract'),
('Collect laptop & access card', 'WEEK1', 'Collect from IT helpdesk'),
('Complete probation check-in', 'MONTH1', 'Meet with manager')

INSERT INTO Trainings (Title, StartsAt, Location, Notes) VALUES
('Welcome + Orientation', DATEADD(day, 1, SYSDATETIME()), 'Room 3-02', 'Bring notebook'),
('Security & Compliance', DATEADD(day, 2, SYSDATETIME()), 'Zoom', 'Join link will be posted')