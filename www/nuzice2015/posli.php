<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta http-equiv="content-type" content="text/html; charset=windows-1250">
<title>Odesílání emailu</title>
</head>
<body>
<h1>Odesílání emailu</h1>

<?
// ** osetreni vstupnich promennych (c) Alsan.cz ** //
function valid($text) {
	$text = stripslashes($text); // prevede zpet escapovani systemem - /" atd.
	$text = htmlspecialchars($text, ENT_QUOTES); // nahradí HTML tagy za entity / ENT_QUOTES - prelozi dvojite i jednoduche uvozovky
	$text = trim($text); // odstraní bílé znaky ze zaeátku a konce oetizce // toto provest az na konci osetrovani !!
	return $text;
}

$predmet = "Prihlaska ".valid($_POST['prijmeni']);
//$email = valid($_POST['prijmeni'])."@".valid($_POST['jmeno'])."cz"; // ???
$email = valid($_POST['mail']);
$spam = valid($_POST['spam']);
$zprava1 = valid($_POST['prijmeni'])." ".valid($_POST['jmeno'])." ".valid($_POST['narozeni'])." ".valid($_POST['vyska'])."cm ".valid($_POST['adresa'])." PSČ:".valid($_POST['psc'])." mail: ".valid($_POST['mail']);
$telefony=" tlf1:".valid($_POST['tlf1'])." tlf2:".valid($_POST['tlf2'])." tlf3:".valid($_POST['tlf3'])." tlf4:".valid($_POST['tlf4']);
$stav=" plavec: ".valid($_POST['plav'])." Zdr.stav: ".valid($_POST['S1'])." Pozn: ".valid($_POST['S2']);
$zprava=$zprava1." telefony:".$telefony." ".$stav;

if ($predmet!="" and $email!="" and $zprava!="" and $spam=="2")
{
Mail("kspohoda@volny.cz", $predmet, $zprava, "From: " . $email);
echo "<p><strong>Váš e-mail byl úspěšně odeslán</strong>.</p>";
}
else
{
echo "<p>Váš e-mail se <strong>nepodařilo odeslat</strong> pravděpodobně jste nevyplnili všechny údaje, nebo nevíte kolik je 1 + 1.</p>";
}
?>
<p align="left"><b><a href="pozvanka.html">Zpět</a></b></p>

</body>
</html>