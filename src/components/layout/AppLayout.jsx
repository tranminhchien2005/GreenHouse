import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import ChatbotWidget from '@/components/chatbot/ChatbotWidget';
import Sidebar from './Sidebar';
import { getMqttClient } from '@/lib/mqttClient';

export default function AppLayout() {
  // Initialize MQTT connection on app load
  useEffect(() => {
    getMqttClient();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-8">
          <Outlet />
        </div>
      </main>
      <ChatbotWidget />
    </div>
  );
}