import 'package:flutter/material.dart';
import 'layouts/note_app_layout.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color.fromARGB(255, 58, 77, 186);
    const secondaryColor = Color.fromARGB(255, 111, 74, 52);
    const accentColor = Color.fromARGB(255, 106, 91, 4);
    const backgroundColor = Color.fromARGB(255, 235, 229, 167);
    const textColor = Colors.black;

    return MaterialApp(
      title: 'Laminotes',
      theme: ThemeData(
        primaryColor: primaryColor,
        scaffoldBackgroundColor: backgroundColor,
        colorScheme: ColorScheme.fromSwatch().copyWith(
          primary: primaryColor,
          secondary: accentColor,
          background: backgroundColor,
        ),
        appBarTheme: const AppBarTheme(
          color: primaryColor,
          titleTextStyle: TextStyle(color: Colors.black, fontSize: 20),
        ),
        buttonTheme: const ButtonThemeData(
          buttonColor: secondaryColor,
          textTheme: ButtonTextTheme.primary,
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: textColor),
          bodyMedium: TextStyle(color: textColor),
        ),
      ),
      home: const NoteAppLayout(),
    );
  }
}