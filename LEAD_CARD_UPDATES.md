# Lead Card UI Updates - Summary

## Overview
Fixed the Lead Display UI in the Envoy dashboard with improved layout, editable drafts, and complete approval workflow implementation.

## Changes Made

### 1. **Lead Type Updated** ([src/types/lead.ts](src/types/lead.ts))
Added optional fields to support editable drafts:
```typescript
editableDraftSubject?: string | null;
editableDraftBody?:    string | null;
```
These fields allow users to edit the AI-generated draft while preserving the original.

### 2. **LeadCard Component Redesigned** ([src/components/leads/LeadCard.tsx](src/components/leads/LeadCard.tsx))

#### **Layout Fixes**
- ✅ **Fixed overlapping elements** using proper flexbox layout:
  - Header section: Name/Title/Company (left, flex: 1) + Status Badge/Fit Score (right, flexShrink: 0)
  - Prevents text wrapping and overlaps
  - Uses `minWidth` and `flex: 1 1 auto` for proper content flow
  - Added margins/gaps between sections

#### **New Features**

##### **1. View Draft Button**
- Only visible for drafted leads with draft content
- Toggle to expand/collapse draft preview
- Clean UI with purple accent (matches drafted status)
- Button shows "▼ View Draft" / "▲ Hide Draft"

##### **2. Editable Draft Textarea**
- **Edit Button**: Toggle between view and edit modes
- **Subject Field**: Text input for email subject
- **Body Field**: Textarea with min-height 150px for email body
- **Preserve Original**: Doesn't overwrite the original generated draft
- **Read-only Display**: Shows formatted preview when not editing
- **Responsive**: Grows vertically with content

##### **3. Action Buttons**
Two main buttons side-by-side for drafted leads:
- **✓ Accept & Send**: 
  - Green accent (rgba(16,185,129,0.12))
  - Disabled in dry-run mode
  - Shows spinner while sending
  - Calls `approveAndSendLead()` API
  
- **✕ Reject**:
  - Red accent (rgba(239,68,68,0.12))
  - Calls `onSkip()` handler
  - Shows spinner while rejecting

##### **4. Status State Management**
New component state:
```typescript
const [editingDraft, setEditingDraft] = useState(false);      // Toggle edit mode
const [editedSubject, setEditedSubject] = useState(...);      // User-edited subject
const [editedBody, setEditedBody] = useState(...);            // User-edited body
const [rejecting, setRejecting] = useState(false);            // Reject action state
```

### 3. **DraftSection Component**
New dedicated component for draft display/editing:
- Handles subject and body display/edit toggle
- Clean header with edit button
- Proper text input/textarea with CSS classes
- Prevents event propagation with `e.stopPropagation()`

## Visual Hierarchy

```
┌─────────────────────────────────────────────┐
│ [Accent] Name                  [Status] [Fit]│  ← Header (flexbox, no overlap)
│         Title · Company                      │
│         [Stage Pill]                         │
├─────────────────────────────────────────────┤
│ ✉ email@example.com ◈ Industry ◎ 50 people │  ← Meta Row
├─────────────────────────────────────────────┤
│ [████████████████████░░░░░░░░] 75%          │  ← Progress Bar
├─────────────────────────────────────────────┤
│ ▶ Drafting email...                         │  ← Step Label
├─────────────────────────────────────────────┤
│ ▼ View Draft                                │  ← View Draft Button (for drafted)
├─────────────────────────────────────────────┤
│ ✉ GENERATED EMAIL DRAFT           ✏ Edit   │  ← Draft Section (when expanded)
│ Subject: "Your subject line"                │
│ Body: "Email content..."                    │
├─────────────────────────────────────────────┤
│ ✓ Accept & Send    ✕ Reject                │  ← Action Buttons
└─────────────────────────────────────────────┘
```

## State Transitions

```
Lead Statuses:
- pending → (review) → approved → sent
- drafted → (expand) → show draft → edit → (Accept) → approved → sent
          └─────────────────→ (Reject) → skipped
```

## CSS/Tailwind

Uses existing design tokens:
- `--card`: Card background
- `--border`: Card border
- `--green`: Accept button accent
- `--red`: Reject button accent
- `#C084FC`: Draft section accent (purple)
- `--t1`, `--t2`, `--t3`: Text colors

All styling is **inline** with CSS variables from global.css.

## Accessibility

- ✅ Proper flex layout prevents text overlap
- ✅ Button states (hover, active, disabled)
- ✅ Error messages displayed
- ✅ Loading states with spinners
- ✅ Keyboard-accessible inputs (textarea/input)
- ✅ Event propagation prevented for nested interactions

## Future Enhancements

1. **Backend API Integration**:
   - Add endpoint to save edited drafts: `PATCH /api/leads/:id/draft`
   - Update `approveAndSendLead()` to send edited draft content

2. **Confirmation Dialogs**:
   - Add confirm before sending
   - Add confirm before rejecting

3. **Draft Version History**:
   - Track original vs edited versions
   - Allow reverting to original draft

4. **Undo Functionality**:
   - Cache edited content
   - Allow undo of edits

## Testing Checklist

- [ ] CSV upload displays leads without layout overlap
- [ ] View Draft button toggles visibility
- [ ] Draft subject/body can be edited
- [ ] Accept & Send button works (integrates with backend)
- [ ] Reject button works (calls onSkip)
- [ ] Dry-run prevents sending
- [ ] Error messages display correctly
- [ ] Responsive layout on smaller screens
- [ ] Animation smooth on expand/collapse
- [ ] Original draft preserved when editing
