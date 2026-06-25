import React, { createContext, useState, useEffect, ReactNode, useContext } from "react";


interface ThemeContextType {
  theme: "light" | "dark";
  changeTheme: () => void;
}


const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    const legacyMode = localStorage.getItem("mode");
    return legacyMode === "true" ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    localStorage.setItem("mode", theme === "dark" ? "true" : "false");
    document.documentElement.classList.remove("light", "dark", "ligth");
    document.documentElement.classList.add(theme);
    document.documentElement.style.backgroundColor =
      theme === "dark" ? "rgb(37, 37, 37)" : "rgb(248, 247, 247)";
    document.body.classList.remove("light", "dark", "ligth");
    document.body.classList.add(theme);
    document.body.style.backgroundColor =
      theme === "dark" ? "rgb(37, 37, 37)" : "rgb(248, 247, 247)";
  }, [theme]);


  const changeTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};


export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("tsy aiko");
  }
  return context;
};
