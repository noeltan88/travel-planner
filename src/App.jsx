import { useState, useRef } from 'react';
import QuizFlow from './components/QuizFlow';
import GeneratingScreen from './components/GeneratingScreen';
import ItineraryDashboard from './components/ItineraryDashboard';
import { buildFullItinerary, recommendHotel } from './utils/algorithm';
import { HOTELS } from './utils/affiliateLinks';

export default function App() {
  const [screen, setScreen] = useState('quiz'); // 'quiz' | 'generating' | 'itinerary'
  const [quizAnswers, setQuizAnswers] = useState({});
  const [itinerary, setItinerary] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [dayStops, setDayStops] = useState([]);
  const [activeTab, setActiveTab] = useState('itinerary');
  const itineraryRef = useRef(null);

  function handleQuizComplete(answers) {
    setQuizAnswers(answers);
    setScreen('generating');

    setTimeout(() => {
      const result = buildFullItinerary(answers);
      const allStops = result.days.flatMap(d => d.stops);

      // Determine primary city for hotel recommendation
      const primaryCity = result.cities[0] || 'guangzhou';
      const hotels = HOTELS[primaryCity] || [];
      const hotel = recommendHotel(allStops, hotels);
      const otherHotels = hotels.filter(h => h.id !== hotel?.id).slice(0, 2);

      setItinerary({ ...result, hotel, otherHotels, hotels });
      setDayStops(result.days.map(d => [...d.stops]));
      setActiveDay(0);
      setScreen('itinerary');
    }, 3200);
  }

  function handleReset() {
    setScreen('quiz');
    setQuizAnswers({});
    setItinerary(null);
    setActiveDay(0);
    setDayStops([]);
    setActiveTab('itinerary');
  }

  function deleteStop(dayIdx, stopId) {
    setDayStops(prev =>
      prev.map((stops, i) =>
        i === dayIdx ? stops.filter(s => s.id !== stopId) : stops
      )
    );
  }

  function swapStop(dayIdx, oldStopId, newStop) {
    setDayStops(prev =>
      prev.map((stops, i) =>
        i === dayIdx
          ? stops.map(s => s.id === oldStopId ? { ...newStop, startTime: s.startTime, endTime: s.endTime } : s)
          : stops
      )
    );
  }

  function addStopToDay(attraction, dayIdx) {
    setDayStops(prev => {
      const next  = [...prev];
      const stops = [...(next[dayIdx] || [])];
      // Avoid duplicates
      if (stops.find(s => s.id === attraction.id)) return prev;
      next[dayIdx] = [...stops, { ...attraction, startTime: 'Added', endTime: '' }];
      return next;
    });
  }

  if (screen === 'quiz') {
    return <QuizFlow onComplete={handleQuizComplete} />;
  }

  if (screen === 'generating') {
    return <GeneratingScreen answers={quizAnswers} />;
  }

  return (
    <ItineraryDashboard
      itinerary={itinerary}
      dayStops={dayStops}
      activeDay={activeDay}
      setActiveDay={setActiveDay}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      deleteStop={deleteStop}
      swapStop={swapStop}
      addStopToDay={addStopToDay}
      itineraryRef={itineraryRef}
      quizAnswers={quizAnswers}
      onReset={handleReset}
    />
  );
}
