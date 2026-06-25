import * as React from 'react';
import { styled, alpha } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import SegmentIcon from '@mui/icons-material/Segment';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import DarkOrWhite from "../DarkOrWhiteToggle/DarkOrWhite";
import StyleIcon from '@mui/icons-material/Style';
import { useTheme } from '../../context/themeContext';

const StyledMenu = styled(Menu)(({ themeProp, theme: muiTheme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: muiTheme.spacing(1),
    minWidth: 180,
    backgroundColor: themeProp === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
    color: themeProp === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        color: themeProp === "light" ? muiTheme.palette.text.secondary : "#fff",
        marginRight: muiTheme.spacing(1.5),
      },
      '&:active': {
        backgroundColor: alpha(
          muiTheme.palette.primary.main,
          muiTheme.palette.action.selectedOpacity
        ),
      },
    },
  },
}));

export default function CustomizedMenus() {
  const { theme } = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handle = () => 0;

  return (
    <div>
      <Button
        id="demo-customized-button"
        aria-controls={open ? 'demo-customized-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        variant="outlined"
        disableElevation
        onClick={handleClick}
        sx={{
          border: "solid 1px",
          padding: "3px 6px",
          minWidth: "35px",
        }}
      >
        <SegmentIcon sx={{ width: 32, height: 32 }} />
      </Button>

      <StyledMenu
        themeProp={theme}
        id="demo-customized-menu"
        MenuListProps={{ 'aria-labelledby': 'demo-customized-button' }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem onClick={handleClose} disableRipple>
          <StyleIcon sx={{ width: 20, height: 20 }} />
          <p style={{ fontSize: 'var(--basicText)' }}>Ticket Journalier</p>
        </MenuItem>

        <MenuItem onClick={handleClose} disableRipple>
          <SmartphoneIcon sx={{ width: 20, height: 20 }} />
          <p style={{ fontSize: 'var(--basicText)' }}>Nous contacter ?</p>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handle} disableRipple>
          <DarkOrWhite />
        </MenuItem>

        <MenuItem
          onClick={handleClose}
          disableRipple
          disabled
          sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "300px" }}
        >
          Version 1.0
          <span style={{ fontSize: "var(--basicText)" }}>catégorie : simple</span>
          <span style={{ fontSize: "var(--basicText)" }}>
            abonnement restant: <strong>25j</strong>
          </span>
          <br />
          <span style={{ fontSize: "var(--basicText)", textAlign: "center" }}>
            Logiciel avec une license, toute <br /><strong>copie ou crack</strong> du logiciel est <br /><strong>strictement interdite</strong>
          </span>
        </MenuItem>
      </StyledMenu>
    </div>
  );
}
