import * as React from 'react';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import { useTheme } from '../../context/themeContext';

export default function TextFields({ Width, Placeholder, onChangeValue, value, disabled }) {
  const { theme } = useTheme();
  const [Invalue, setValue] = React.useState("");

  const handleChange = (event, newValue) => {
    setValue(newValue);
    if (onChangeValue) {
      onChangeValue(newValue);
    }
  };


  return (
    <Stack spacing={2} sx={{ width: Width ? Width : 200 }}>
      <Autocomplete
        freeSolo
        id="free-solo-2-demo"
        value={value}
        disabled={disabled ? disabled : false}
		getOptionLabel={(option) => String(option)}
        onInputChange={handleChange}
        sx={{
          width: Width ? Width : '200px',
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
            top: "0px",
            fontSize: '16px',
            paddingRight: "20px",
            backgroundColor: theme == "light" ? "var(--whiteBeMax)" : "var(--noirbe)" 
          },
          "& .MuiOutlinedInput-root": {
            height: '40px',
            minHeight: '40px',
            ".MuiSvgIcon-root": {
              color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)"
            },
            "& fieldset ": {
              borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
            "&:hover fieldset": {
              borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
            "&.Mui-focused fieldset": {
              borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
          },
         "& .MuiOutlinedInput-root.Mui-disabled fieldset": {
          borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
          },
          "& .MuiInputBase-root.Mui-disabled": {
            color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
          },
          "& .MuiInputBase-input.Mui-disabled": {
            color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)", 
            WebkitTextFillColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
          },
          "& .MuiInputLabel-root.Mui-disabled": {
            color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
          },
        }}
        options={top100Films.map((option) => option.title)}
        renderInput={(params) => (
          <TextField
          
            {...params}
            label={Placeholder ? Placeholder : "Nom du produit"}
            slotProps={{
              input: {
                ...params.InputProps,
                type: 'text',
              },
            }}
          />
        )}
      />
    </Stack>
  );
}

const top100Films = [];
