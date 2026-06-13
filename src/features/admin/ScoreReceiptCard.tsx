import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  buildScoreReceipt,
  type ScoreReceiptAttemptInput,
  type ScoreReceiptLine,
  type ScoreReceiptUserInput,
} from '@features/admin/buildScoreReceipt';

type Props = {
  attempt: ScoreReceiptAttemptInput;
  user?: ScoreReceiptUserInput | null;
  passThreshold?: number;
  variant?: 'light' | 'dark';
};

function formatAmount(amount: number | null | undefined, kind: ScoreReceiptLine['kind']): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  if (kind === 'outcome') return amount >= 1 ? 'PASS' : 'FAIL';
  if (kind === 'threshold') return amount.toFixed(2);
  if (kind === 'total' || kind === 'subtotal' || kind === 'base') return amount.toFixed(2);
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`;
}

function amountColor(amount: number | null | undefined, kind: ScoreReceiptLine['kind']): string | undefined {
  if (amount == null || !Number.isFinite(amount)) return undefined;
  if (kind === 'outcome') return amount >= 1 ? '#22c55e' : '#ef4444';
  if (kind === 'gate_fail') return '#ef4444';
  if (kind === 'adjustment') {
    if (amount < 0) return '#ef4444';
    if (amount > 0) return '#22c55e';
  }
  return undefined;
}

function ReceiptRow({
  line,
  variant,
}: {
  line: ScoreReceiptLine;
  variant: 'light' | 'dark';
}) {
  const isDark = variant === 'dark';

  if (line.kind === 'section') {
    return (
      <View style={[styles.sectionRow, isDark && styles.sectionRowDark]}>
        <Text style={[styles.sectionText, isDark && styles.sectionTextDark]}>{line.label}</Text>
      </View>
    );
  }

  const isTotal = line.kind === 'total';
  const isSubtotal = line.kind === 'subtotal';
  const isThreshold = line.kind === 'threshold';
  const isOutcome = line.kind === 'outcome';
  const isGateFail = line.kind === 'gate_fail';
  const isNote = line.kind === 'note';
  const color = amountColor(line.amount, line.kind);

  return (
    <View
      style={[
        styles.row,
        isDark && styles.rowDark,
        (isSubtotal || isTotal) && styles.rowEmphasis,
        (isSubtotal || isTotal) && isDark && styles.rowEmphasisDark,
        isGateFail && styles.rowGateFail,
      ]}
    >
      <View style={styles.labelCol}>
        <Text
          style={[
            styles.label,
            isDark && styles.labelDark,
            (isSubtotal || isTotal || isOutcome) && styles.labelStrong,
            (isSubtotal || isTotal || isOutcome) && isDark && styles.labelStrongDark,
            isGateFail && styles.labelGateFail,
            isNote && styles.labelNote,
          ]}
        >
          {isGateFail ? `⛔ ${line.label}` : line.label}
        </Text>
        {line.detail ? (
          <Text style={[styles.detail, isDark && styles.detailDark, isGateFail && styles.detailGateFail]}>
            {line.detail}
          </Text>
        ) : null}
      </View>
      {!isNote && !isGateFail ? (
        <Text
          style={[
            styles.amount,
            isDark && styles.amountDark,
            (isSubtotal || isTotal || isThreshold || isOutcome) && styles.amountStrong,
            color != null ? { color } : null,
          ]}
        >
          {formatAmount(line.amount, line.kind)}
        </Text>
      ) : null}
    </View>
  );
}

export function ScoreReceiptCard({ attempt, user, passThreshold, variant = 'dark' }: Props) {
  const receipt = useMemo(
    () => buildScoreReceipt({ attempt, user, passThreshold }),
    [attempt, user, passThreshold],
  );
  const isDark = variant === 'dark';

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
        <Text style={[styles.title, isDark && styles.titleDark]}>Score receipt</Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>Line-by-line deductions</Text>
      </View>
      {receipt.lines.map((line, index) => (
        <ReceiptRow key={`${line.kind}-${line.label}-${index}`} line={line} variant={variant} />
      ))}
    </View>
  );
}

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardDark: {
    backgroundColor: '#111',
    borderColor: '#222',
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fafafa',
  },
  headerRowDark: {
    borderBottomColor: '#222',
    backgroundColor: '#161616',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  titleDark: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#888',
  },
  sectionRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#f5f5f5',
  },
  sectionRowDark: {
    backgroundColor: '#161616',
  },
  sectionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTextDark: {
    color: '#888',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowDark: {
    borderBottomColor: '#1a1a1a',
  },
  rowEmphasis: {
    backgroundColor: '#fafafa',
  },
  rowEmphasisDark: {
    backgroundColor: '#141414',
  },
  rowGateFail: {
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  labelCol: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 13,
    color: '#333',
  },
  labelDark: {
    color: '#ddd',
  },
  labelStrong: {
    fontWeight: '700',
    color: '#111',
  },
  labelStrongDark: {
    color: '#fff',
  },
  labelGateFail: {
    color: '#ef4444',
    fontWeight: '600',
  },
  labelNote: {
    color: '#888',
    fontStyle: 'italic',
  },
  detail: {
    fontSize: 11,
    color: '#777',
    lineHeight: 15,
  },
  detailDark: {
    color: '#888',
  },
  detailGateFail: {
    color: '#b91c1c',
  },
  amount: {
    fontSize: 13,
    fontFamily: mono,
    color: '#333',
    minWidth: 56,
    textAlign: 'right',
  },
  amountDark: {
    color: '#eee',
  },
  amountStrong: {
    fontSize: 14,
    fontWeight: '700',
  },
});
