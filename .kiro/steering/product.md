# Product Overview

**ゆいじゅ（悠酱）** is an AI-powered virtual character simulation system that creates an autonomous living world for a character named "悠酱" (Yuiju).

## Core Concept
The project simulates a character's daily life through autonomous behavior decisions, real-time state management, and interactive messaging capabilities. The character lives in a virtual world with daily routines like waking up, eating, fishing, going to school, and sleeping.

## Key Features
- **Autonomous Life Simulation**: Character makes independent decisions about daily activities
- **Real-time State Management**: Tracks character attributes like energy, mood, and world state
- **Interactive Messaging**: QQ bot integration for external user interaction
- **Memory System**: Persistent memory storage using mem0ai for conversation context
- **Behavior Tree System**: Uses mistreevous for complex behavior decision-making

## Architecture
The system follows a modular architecture with clear separation between interaction layer (message), simulation engine (world), data/settings (source), and shared utilities (utils).