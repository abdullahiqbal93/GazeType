'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { UserSettings, DEFAULT_SETTINGS, CalibrationModel, Point2D } from '@/lib/types';

interface AppState {
  settings: UserSettings;
  calibration: CalibrationModel | null;
  typedText: string;
  gazePoint: Point2D | null;
  isTracking: boolean;
  cameraAllowed: boolean;
  debugInfo: {
    fps: number;
    ratios: { avgX: number; avgY: number } | null;
  };
}

type Action =
  | { type: 'SET_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_CALIBRATION'; payload: CalibrationModel | null }
  | { type: 'SET_TYPED_TEXT'; payload: string }
  | { type: 'APPEND_TEXT'; payload: string }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR_TEXT' }
  | { type: 'SET_GAZE_POINT'; payload: Point2D | null }
  | { type: 'SET_TRACKING'; payload: boolean }
  | { type: 'SET_CAMERA_ALLOWED'; payload: boolean }
  | { type: 'SET_DEBUG_INFO'; payload: Partial<AppState['debugInfo']> };

const initialState: AppState = {
  settings: DEFAULT_SETTINGS,
  calibration: null,
  typedText: '',
  gazePoint: null,
  isTracking: false,
  cameraAllowed: false,
  debugInfo: { fps: 0, ratios: null },
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_CALIBRATION':
      return { ...state, calibration: action.payload };
    case 'SET_TYPED_TEXT':
      return { ...state, typedText: action.payload };
    case 'APPEND_TEXT':
      return { ...state, typedText: state.typedText + action.payload };
    case 'BACKSPACE':
      return { ...state, typedText: state.typedText.slice(0, -1) };
    case 'CLEAR_TEXT':
      return { ...state, typedText: '' };
    case 'SET_GAZE_POINT':
      return { ...state, gazePoint: action.payload };
    case 'SET_TRACKING':
      return { ...state, isTracking: action.payload };
    case 'SET_CAMERA_ALLOWED':
      return { ...state, cameraAllowed: action.payload };
    case 'SET_DEBUG_INFO':
      return { ...state, debugInfo: { ...state.debugInfo, ...action.payload } };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppState must be used within AppProvider');
  return context;
}

export function useSettings() {
  const { state, dispatch } = useAppState();
  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      dispatch({ type: 'SET_SETTINGS', payload: updates });
    },
    [dispatch]
  );
  return { settings: state.settings, updateSettings };
}
