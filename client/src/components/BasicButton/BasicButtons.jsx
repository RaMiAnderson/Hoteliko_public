import * as React from 'react';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { purple } from '@mui/material/colors';


const normalizeButtonPadding = (rawPadding) => {
  if (typeof rawPadding !== "string") return rawPadding;

  const values = rawPadding.trim().split(/\s+/);
  if (values.length === 0) return rawPadding;

  const parsePx = (value) => {
    if (!value || !value.endsWith("px")) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  if (values.length === 4) {
    const [top, right, bottom, left] = values;
    const topPx = parsePx(top);
    const bottomPx = parsePx(bottom);

    if (topPx !== null && bottomPx !== null && Math.abs(topPx - bottomPx) > 0.01) {
      const balancedVertical = `${((topPx + bottomPx) / 2).toFixed(2)}px`;
      return `${balancedVertical} ${right} ${balancedVertical} ${left}`;
    }
  }

  if (values.length === 3) {
    const [top, horizontal, bottom] = values;
    const topPx = parsePx(top);
    const bottomPx = parsePx(bottom);

    if (topPx !== null && bottomPx !== null && Math.abs(topPx - bottomPx) > 0.01) {
      const balancedVertical = `${((topPx + bottomPx) / 2).toFixed(2)}px`;
      return `${balancedVertical} ${horizontal} ${balancedVertical}`;
    }
  }

  return rawPadding;
};


const ColorButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(purple[500]),
  backgroundColor: purple[500],
  '&:hover': {
    backgroundColor: purple[700],
  },
}));

export default function CustomizedButtons({variant, color, colorH, bgColor, bgColorH, bgColorA,brdrColor, brdrColorH, textBtn, width, padding, StartIcon, onClick}) {
    const normalizedPadding = normalizeButtonPadding(padding);
    const BootstrapButton = styled(Button)({
        boxShadow: 'none',
        display : "inline-flex",
        color : color,
        width: width,
        alignItems : "center",
        justifyContent : "center",
        gap: StartIcon ? "8px" : "0px",
        minHeight: "40px",
        textTransform: 'none',
        fontSize: "var(--btnText)",
        padding: normalizedPadding,
        lineHeight: 1.2,
        backgroundColor: bgColor,
        borderColor: brdrColor,
        fontFamily: "poppins",
        "& svg": {
          display: "block"
        },
        '&:hover': {
          color : colorH,
          backgroundColor: bgColorH,
          borderColor: brdrColorH,
          boxShadow: 'none',
        },
        '&:active': {
          boxShadow: 'none',
          backgroundColor: bgColorA,
          borderColor: brdrColorH,
        },
        
      });
  return (
    <Stack spacing={2} direction="row">
      {/* <ColorButton variant={variant}>Custom CSS</ColorButton> */}
      <BootstrapButton onClick={() => onClick && onClick()} variant={variant}>
        {StartIcon}
        {textBtn}
      </BootstrapButton>
    </Stack>
  );
}
