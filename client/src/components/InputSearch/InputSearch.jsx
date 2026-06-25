import * as React from 'react';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import { useTheme } from '../../context/themeContext';

export default function FreeSolo({
  value = "",
  onChangeValue = () => {},
  options = [],
  label = "Nom du Produit",
  onKeyDown
}) {
  const { theme } = useTheme();
  return (
    <Stack spacing={2} sx={{ width: 200 }}>
      <Autocomplete
        freeSolo
        id="free-solo-2-demo"
        disableClearable
        sx={{
          width: '200px', 
          "& .MuiInputBase-root": {
            height: '40px', 
            minHeight: '40px',
            padding: '0 14px', 
            display: 'flex',
            fontSize: 'var(--basicText)',
            alignItems: 'center',
            overflow: 'hidden',
            lineHeight: '1.2',
            color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
          },
          "& .MuiInputLabel-root": {
            fontSize: 'var(--basicText)', 
            top: '-4px', 
            color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
          },
          "& .MuiOutlinedInput-input": {
            top: "10px",
            fontSize: "var(--basicText)"
          },
          "& .MuiInputLabel-shrink": {
            top: "2px",
            fontSize: '15px',
          },


          "& .MuiOutlinedInput-root": {
            height: '40px', 
            minHeight: '40px',
            ".MuiSvgIcon-root": {
              color: theme == "light" ? "var(--noirbeBorder)" : "var(--whiteKely)"
            },
            "& fieldset": {
              borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
            "&:hover fieldset": {
              borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
            "&.Mui-focused fieldset": {
              borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
          },
        }}
        options={options}
		
		value={value}
		getOptionLabel={(option) => String(option)}
        onInputChange={(event, newValue) => {
          onChangeValue(newValue);
        }}
		slotProps={{
			paper: {
				sx: {
					backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
					color: theme === "light" ? "var(--noirbe)" : "var(--white)",
					fontSize: "14px",
				}
			},
			listbox: {
				sx: {
        			"&::-webkit-scrollbar": {
        			  width: "10px",
        			  height: "10px",
        			},
        			"&::-webkit-scrollbar-track": {
        			  background: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
        			  borderRadius: "8px",
        			},
        			"&::-webkit-scrollbar-thumb": {
					   backgroundColor: theme === "light" ? "rgba(0, 0, 0, 0.24)" : "rgba(255, 255, 255, 0.16)",
					   borderRadius : "15px"
        			},
				
        			"& .MuiAutocomplete-option:hover": {
        			  backgroundColor: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
        			},
				}
			}
		}}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            onKeyDown={onKeyDown}
            slotProps={{
              input: {
                ...params.InputProps,
                type: 'search',
              },
            }}
          />
        )}
      />
    </Stack>
  );
}
