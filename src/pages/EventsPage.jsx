/**
 * Events Page
 * 
 * Event tracking calendar and analysis view
 */

import { createElement as h } from 'react';
import { EventsPanel } from '../components/events/index.js';
import { useEventStore } from '../stores/eventStore.js';

export function EventsPage() {
  // Get state from stores
  const newsEvents = useEventStore(state => state.newsEvents);
  const setNewsEvents = useEventStore(state => state.setNewsEvents);
  const filterType = useEventStore(state => state.filterType);
  const setFilterType = useEventStore(state => state.setFilterType);
  const showRelayPlan = true; // Always show relay plan
  const relayPlanExpanded = false;
  const setRelayPlanExpanded = () => {};
  
  // Filter events by type
  const filteredEvents = newsEvents.filter(event => {
    if (filterType === '全部') return true;
    return event.type === filterType;
  });
  
  return h(EventsPanel, {
    showRelayPlan,
    relayPlanExpanded,
    setRelayPlanExpanded,
    filterType,
    setFilterType,
    filteredEvents,
  });
}
