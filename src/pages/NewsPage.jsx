/**
 * News Analysis Page
 * 
 * Event news analysis and review view
 */

import { createElement as h } from 'react';
import { NewsAnalysisPanel } from '../components/news/index.js';
import { useEventStore } from '../stores/eventStore.js';

export function NewsPage() {
  // Get state from stores
  const newsEvents = useEventStore(state => state.newsEvents);
  const reviewingEvent = useEventStore(state => state.reviewingEvent);
  const setReviewingEvent = useEventStore(state => state.setReviewingEvent);
  const reviewForm = useEventStore(state => state.reviewForm);
  const setReviewForm = useEventStore(state => state.setReviewForm);
  const expandedNews = useEventStore(state => state.expandedNews);
  const setExpandedNews = useEventStore(state => state.setExpandedNews);
  
  // Handlers
  const submitReview = async () => {
    if (!reviewingEvent) return;
    
    // Update event with review data
    const updates = {
      status: 'closed',
      exitDate: reviewForm.exitDate || new Date().toISOString().slice(0, 10),
      reviewDate: reviewForm.exitDate || new Date().toISOString().slice(0, 10),
      actual: reviewForm.actual,
      actualNote: reviewForm.actualNote,
      lessons: reviewForm.lessons,
      priceAtExit: reviewForm.priceAtExit ? { [reviewingEvent.code]: reviewForm.priceAtExit } : null,
    };
    
    // TODO: Call store action to update event
    setReviewingEvent(null);
    setReviewForm({
      actual: 'up',
      actualNote: '',
      lessons: '',
      exitDate: null,
      priceAtExit: null,
    });
  };
  
  const cancelReview = () => {
    setReviewingEvent(null);
    setReviewForm({
      actual: 'up',
      actualNote: '',
      lessons: '',
      exitDate: null,
      priceAtExit: null,
    });
  };
  
  const createDefaultReviewForm = () => ({
    actual: 'up',
    actualNote: '',
    lessons: '',
    exitDate: null,
    priceAtExit: null,
  });
  
  return h(NewsAnalysisPanel, {
    newsEvents,
    reviewingEvent,
    reviewForm,
    setReviewForm,
    submitReview,
    cancelReview,
    setExpandedNews,
    expandedNews,
    setTab: () => {}, // TODO: Implement navigation
    setReviewingEvent,
    createDefaultReviewForm,
  });
}
