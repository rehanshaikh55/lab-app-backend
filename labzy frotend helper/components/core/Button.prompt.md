Labzy button for all tap actions — primary teal fill for the single main action per screen, secondary/outline/ghost for everything else.

```jsx
<Button size="lg" fullWidth icon="calendar" onClick={book}>Book home collection</Button>
<Button variant="outline" size="sm">View details</Button>
```

Variants: primary (teal fill), secondary (teal-soft fill), outline, ghost, danger. Sizes sm 36 / md 44 / lg 52. Press = scale(0.97); hover = one shade darker.
