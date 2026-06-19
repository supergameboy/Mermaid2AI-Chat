import { describe, it, expect } from 'vitest';
import { getEdgeMarkerConfig, isCustomMarker, getCustomMarkerId, toMarkerUrl } from './edge-markers.js';
import type { MermaidEdgeStyle } from '@mermaid-editor/serializer';

describe('edge-markers', () => {
  describe('getEdgeMarkerConfig', () => {
    it('should return custom:arrow marker for arrow style', () => {
      const config = getEdgeMarkerConfig('arrow');
      expect(config.markerEndType).toBe('custom:arrow');
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return no marker for line style', () => {
      const config = getEdgeMarkerConfig('line');
      expect(config.markerEndType).toBeUndefined();
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return no marker for dotted style', () => {
      const config = getEdgeMarkerConfig('dotted');
      expect(config.markerEndType).toBeUndefined();
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return custom:arrow marker for dotted-arrow style', () => {
      const config = getEdgeMarkerConfig('dotted-arrow');
      expect(config.markerEndType).toBe('custom:arrow');
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return custom:arrow marker for thick style', () => {
      const config = getEdgeMarkerConfig('thick');
      expect(config.markerEndType).toBe('custom:arrow');
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return custom:circle marker for circle style (mermaid ---o)', () => {
      const config = getEdgeMarkerConfig('circle');
      expect(config.markerEndType).toBe('custom:circle');
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return custom:cross marker for cross style (mermaid ---x)', () => {
      const config = getEdgeMarkerConfig('cross');
      expect(config.markerEndType).toBe('custom:cross');
      expect(config.markerStartType).toBeUndefined();
    });

    it('should return bidirectional markers for bidirectional style (mermaid <--->)', () => {
      const config = getEdgeMarkerConfig('bidirectional');
      expect(config.markerEndType).toBe('custom:arrow');
      expect(config.markerStartType).toBe('custom:arrow');
    });

    it('should fallback to arrow config for unknown style', () => {
      const config = getEdgeMarkerConfig('unknown' as MermaidEdgeStyle);
      expect(config.markerEndType).toBe('custom:arrow');
    });
  });

  describe('isCustomMarker', () => {
    it('should return true for custom:arrow', () => {
      expect(isCustomMarker('custom:arrow')).toBe(true);
    });

    it('should return true for custom:cross', () => {
      expect(isCustomMarker('custom:cross')).toBe(true);
    });

    it('should return false for arrowclosed', () => {
      expect(isCustomMarker('arrowclosed')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCustomMarker(undefined)).toBe(false);
    });
  });

  describe('getCustomMarkerId', () => {
    it('should convert custom:cross to mermaid-cross-marker', () => {
      expect(getCustomMarkerId('custom:cross')).toBe('mermaid-cross-marker');
    });

    it('should convert custom:arrow to mermaid-arrow-marker', () => {
      expect(getCustomMarkerId('custom:arrow')).toBe('mermaid-arrow-marker');
    });

    it('should convert custom:circle to mermaid-circle-marker', () => {
      expect(getCustomMarkerId('custom:circle')).toBe('mermaid-circle-marker');
    });
  });

  describe('toMarkerUrl', () => {
    it('should convert custom:arrow to url(#mermaid-arrow-marker)', () => {
      expect(toMarkerUrl('custom:arrow')).toBe('url(#mermaid-arrow-marker)');
    });

    it('should convert custom:circle to url(#mermaid-circle-marker)', () => {
      expect(toMarkerUrl('custom:circle')).toBe('url(#mermaid-circle-marker)');
    });

    it('should convert custom:cross to url(#mermaid-cross-marker)', () => {
      expect(toMarkerUrl('custom:cross')).toBe('url(#mermaid-cross-marker)');
    });

    it('should return undefined for undefined input', () => {
      expect(toMarkerUrl(undefined)).toBeUndefined();
    });

    it('should return undefined for non-custom type', () => {
      expect(toMarkerUrl('arrowclosed')).toBeUndefined();
    });
  });
});
