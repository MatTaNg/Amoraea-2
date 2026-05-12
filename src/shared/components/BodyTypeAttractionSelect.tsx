import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { FormControlSurface, FormField, formControlStyles } from '@/shared/ui/FormField';
import {
  BODY_TYPE_ATTRACTION_IDS,
  parseBodyTypeAttraction,
  type BodyTypeAttractionId,
} from '@/shared/constants/bodyTypeAttraction';

const createPortalWeb =
  Platform.OS === 'web'
    ? (require('react-dom').createPortal as (typeof import('react-dom'))['createPortal'])
    : null;

/**
 * Multi-select control aligned with edit-profile / embedded dealbreaker styling.
 * Stores canonical ids array (`[]` = no preference).
 */
export const BodyTypeAttractionSelect: React.FC<{
  value?: unknown;
  onChange?: (next: BodyTypeAttractionId[]) => void;
  label?: string;
}> = ({ value, onChange, label = 'What body type are you attracted to?' }) => {
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  /** Fixed viewport rect for web portal menu (escapes ScrollView stacking — see debug logs hypothesis B). */
  const [portalBox, setPortalBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const ids = useMemo(() => parseBodyTypeAttraction(value), [value]);

  const options = useMemo(
    () => [
      { label: 'No preference', value: '' as const },
      ...BODY_TYPE_ATTRACTION_IDS.map((id) => ({ label: id, value: id })),
    ],
    [],
  );

  const emit = (raw: string) => {
    if (!onChange) return;
    if (raw === '') {
      onChange([]);
      return;
    }
    if (BODY_TYPE_ATTRACTION_IDS.includes(raw as BodyTypeAttractionId)) {
      const next = raw as BodyTypeAttractionId;
      onChange(ids.includes(next) ? ids.filter((id) => id !== next) : [...ids, next]);
    }
  };

  const selectedLabel = ids.length ? ids.join(', ') : 'No preference';

  const updatePortalBox = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const trigger = document.getElementById('body-type-attraction-trigger');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const maxHeight = Math.max(160, window.innerHeight - r.bottom - gap - 16);
    setPortalBox({
      top: r.bottom + gap,
      left: r.left,
      width: r.width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !open) {
      setPortalBox(null);
      return;
    }
    updatePortalBox();
  }, [open, updatePortalBox]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onScrollOrResize = () => updatePortalBox();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePortalBox]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !open || typeof document === 'undefined') return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const menu = document.getElementById('body-type-attraction-dropdown');
      const trigger = document.getElementById('body-type-attraction-trigger');
      if (menu?.contains(target) || trigger?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !open) return;
    const probe = () => {
      const menu = document.getElementById('body-type-attraction-dropdown');
      const firstRole = menu?.querySelector('[role="button"]') as HTMLElement | null;
      const inner = firstRole?.firstElementChild as HTMLElement | null;
      const firstDirect = menu?.firstElementChild as HTMLElement | null;
      const csMenu = menu ? getComputedStyle(menu) : null;
      const csRole = firstRole ? getComputedStyle(firstRole) : null;
      const csInner = inner ? getComputedStyle(inner) : null;
      const csFirstDirect = firstDirect ? getComputedStyle(firstDirect) : null;
      const ancestors: Array<{ tag: string; opacity: string; overflow: string; mixBlend: string }> =
        [];
      let el: HTMLElement | null = menu;
      let depth = 0;
      while (el && depth < 14) {
        const cs = getComputedStyle(el);
        ancestors.push({
          tag: el.tagName,
          opacity: cs.opacity,
          overflow: cs.overflow,
          mixBlend: cs.mixBlendMode,
        });
        el = el.parentElement;
        depth += 1;
      }
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '4b3376',
        },
        body: JSON.stringify({
          sessionId: '4b3376',
          hypothesisId: 'A',
          location: 'BodyTypeAttractionSelect.tsx:probe_styles',
          message: 'dropdown_dom_computed_backgrounds',
          data: {
            menuDomId: menu?.id ?? null,
            bgMenu: csMenu?.backgroundColor ?? null,
            bgRole: csRole?.backgroundColor ?? null,
            bgInner: csInner?.backgroundColor ?? null,
            bgFirstDirectChild: csFirstDirect?.backgroundColor ?? null,
            opacityMenu: csMenu?.opacity ?? null,
          },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '4b3376',
        },
        body: JSON.stringify({
          sessionId: '4b3376',
          hypothesisId: 'B',
          location: 'BodyTypeAttractionSelect.tsx:probe_ancestors',
          message: 'dropdown_ancestor_chain',
          data: { ancestors },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '4b3376',
        },
        body: JSON.stringify({
          sessionId: '4b3376',
          hypothesisId: 'C',
          location: 'BodyTypeAttractionSelect.tsx:probe_id',
          message: 'nativeID_maps_to_dom',
          data: {
            expectedId: 'body-type-attraction-dropdown',
            actualId: menu?.id ?? null,
            idMatches: menu?.id === 'body-type-attraction-dropdown',
          },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
    };
    requestAnimationFrame(() => requestAnimationFrame(probe));
  }, [open]);

  const renderOptions = (closeOnNoPreference = false) => (
    <>
      {options.map((o) => {
        const isSelected = o.value === '' ? ids.length === 0 : ids.includes(o.value);
        const isHovered = o.value === hoveredValue;
        return (
          <Pressable
            key={o.value === '' ? '__none__' : o.value}
            style={styles.webOptionHit}
            onPress={() => {
              emit(o.value);
              if (closeOnNoPreference && o.value === '') {
                setOpen(false);
              }
            }}
            onHoverIn={() => setHoveredValue(o.value)}
            onHoverOut={() => setHoveredValue(null)}
          >
            {/*
              RN Web often skips painting backgroundColor on the Pressable root.
              Opaque fill lives on this inner View so options aren’t see-through.
            */}
            <View
              style={[
                styles.webOptionInner,
                isSelected && styles.webOptionSelected,
                isHovered && styles.webOptionHover,
              ]}
            >
              <Text style={[styles.webOptionText, isSelected && styles.webOptionTextSelected]}>
                {o.label}
              </Text>
              {isSelected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </>
  );

  if (Platform.OS === 'web') {
    const portalMenu =
      open &&
      portalBox &&
      typeof document !== 'undefined' &&
      createPortalWeb &&
      createPortalWeb(
        <View
          nativeID="body-type-attraction-dropdown"
          style={[
            styles.webPortalMenu,
            {
              top: portalBox.top,
              left: portalBox.left,
              width: portalBox.width,
              maxHeight: portalBox.maxHeight,
            },
          ]}
        >
          {renderOptions(true)}
        </View>,
        document.body,
      );

    return (
      <FormField label={label} helperText="Select all that apply." style={styles.webFieldBlock}>
        <View nativeID="body-type-attraction-trigger" collapsable={false}>
          <FormControlSurface
            style={styles.triggerContent}
            onPress={() => setOpen((prev) => !prev)}
          >
            <Text style={[formControlStyles.valueText, styles.triggerText]}>{selectedLabel}</Text>
            <Text style={styles.webChevron}>{open ? '▴' : '▾'}</Text>
          </FormControlSurface>
        </View>
        {portalMenu}
      </FormField>
    );
  }

  return (
    <FormField label={label} helperText="Select all that apply.">
      <FormControlSurface
        style={styles.triggerContent}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text style={[formControlStyles.valueText, styles.triggerText]}>{selectedLabel}</Text>
        <Text style={styles.webChevron}>{open ? '▴' : '▾'}</Text>
      </FormControlSurface>
      {open ? <View style={styles.nativeOptionsMenu}>{renderOptions(true)}</View> : null}
    </FormField>
  );
};

const styles = StyleSheet.create({
  webFieldBlock: {
    position: 'relative',
    zIndex: 20,
    overflow: 'visible',
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  triggerText: {
    flex: 1,
    flexWrap: 'wrap',
  },
  webChevron: {
    color: 'rgba(156,180,216,0.9)',
    fontSize: 14,
    paddingLeft: 10,
  },
  /** Portal to document.body — avoids ScrollView overflow/stacking making option rows look transparent (logs: ancestor overflow hidden auto). */
  webPortalMenu: {
    position: 'fixed',
    zIndex: 100000,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    boxShadow: '0 18px 36px rgba(0,0,0,0.35)' as unknown as string,
  },
  nativeOptionsMenu: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  /** Full-width hit target; avoid backgrounds here (see webOptionInner). */
  webOptionHit: {
    width: '100%',
  },
  webOptionInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.card,
  },
  webOptionHover: {
    backgroundColor: '#1a2433',
  },
  webOptionSelected: {
    backgroundColor: 'rgba(91,168,232,0.28)',
  },
  webOptionText: {
    flex: 1,
    color: '#C8D9EE',
    fontSize: 15,
  },
  webOptionTextSelected: {
    color: '#EEF6FF',
    fontWeight: '600',
  },
  selectedBadge: {
    color: '#9CB4D8',
    fontSize: 12,
    fontWeight: '600',
  },
});
